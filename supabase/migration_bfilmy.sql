-- Run this once in your Supabase project's SQL Editor
-- (Project > SQL Editor > New query > paste > Run). Safe to re-run.
--
-- Storage for BFILMY box-office data (see lib/bfilmy/*). A background
-- job (app/api/cron/bfilmy/route.ts) pulls BFILMY's public daily files
-- every 30 minutes and writes them here; every page on fyre reads from
-- these tables instead of scraping a third-party site on each visit.
--
-- bf_movie_day -- one row per movie x kind (boxoffice/advance) x show date.
--   totals:    additive figures for that movie on that date (all formats
--              and dubbed languages combined) + distinct city count.
--   breakdown: entries (format x language), states, formats, languages as
--              objects; cities and chains as compact positional tuples:
--                city:  [name, state, gross, sold, shows, totalSeats, fastfilling, housefull]
--                chain: [name, gross, sold, shows, totalSeats, fastfilling, housefull]
--              (lib/bfilmy/types.ts BfCityTuple / BfChainTuple -- keep in sync).
-- bf_movie     -- one summary row per movie, rebuilt by bf_refresh_movies().
-- bf_sync_state -- last sync run details, for "updated X ago" and debugging.

create table if not exists bf_movie_day (
  slug text not null,
  kind text not null check (kind in ('boxoffice', 'advance')),
  date date not null,
  title text not null,
  totals jsonb not null,
  breakdown jsonb not null,
  source_updated text,
  pruned boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (slug, kind, date)
);
create index if not exists bf_movie_day_kind_date_idx on bf_movie_day (kind, date);
-- Small copies of each day's language/format lists, kept by Postgres
-- itself, so bf_refresh_movies can rank a film's languages/formats without
-- unpacking every day's full breakdown (cities/chains make it large --
-- reading it for every day of a long run timed out).
alter table bf_movie_day add column if not exists lang_list jsonb generated always as (breakdown->'languages') stored;
alter table bf_movie_day add column if not exists format_list jsonb generated always as (breakdown->'formats') stored;

create table if not exists bf_movie (
  slug text primary key,
  title text not null,
  languages text[] not null default '{}',  -- ordered by gross, first = primary language
  formats text[] not null default '{}',    -- ordered by gross
  poster text,
  release_date date,                        -- Day 1: first box-office date (or the day after a premiere), else first advance date
  premiere_date date,                       -- the day just before Day 1, if it had shows: "Day 0 (Pre-release)"
  first_date date,                          -- first box-office date (Day 1)
  last_date date,                           -- latest box-office date
  days_tracked int not null default 0,
  total_gross numeric not null default 0,
  total_sold bigint not null default 0,
  total_shows bigint not null default 0,
  total_seats bigint not null default 0,
  latest jsonb,                             -- latest box-office day: totals + date
  best jsonb,                               -- highest-grossing box-office day: totals + date
  advance jsonb,                            -- release-day (unreleased) or next-day (running) advance: totals + date
  advance_date date,                        -- furthest advance date published
  source_updated text,
  updated_at timestamptz not null default now()
);
alter table bf_movie add column if not exists premiere_date date;
-- true when the film was already running on the first day BFILMY's public
-- archive covers (2025-01-01): its real release date and pre-2025
-- collections are unknown, so totals are "since 1 Jan 2025", not lifetime.
alter table bf_movie add column if not exists carried_over boolean not null default false;

-- One stable URL slug + display title per film identity (normalized
-- title key, lib/bfilmy/normalize.ts groupKey), fixed the first time the
-- film is seen, so spelling variants across days never split one film
-- into two pages. Written only by the sync job.
create table if not exists bf_title_key (
  key text primary key,
  slug text not null unique,
  title text not null,
  created_at timestamptz not null default now()
);
alter table bf_title_key enable row level security;
create index if not exists bf_movie_last_date_idx on bf_movie (last_date);
create index if not exists bf_movie_advance_date_idx on bf_movie (advance_date);

create table if not exists bf_sync_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Public read (pages use the anon key); writes only via the service-role
-- key used by the sync job, which bypasses RLS.
alter table bf_movie_day enable row level security;
alter table bf_movie enable row level security;
alter table bf_sync_state enable row level security;
drop policy if exists "bf_movie_day public read" on bf_movie_day;
create policy "bf_movie_day public read" on bf_movie_day for select using (true);
drop policy if exists "bf_movie public read" on bf_movie;
create policy "bf_movie public read" on bf_movie for select using (true);
drop policy if exists "bf_sync_state public read" on bf_sync_state;
create policy "bf_sync_state public read" on bf_sync_state for select using (true);

-- Rebuilds the bf_movie summary for the given slugs from their bf_movie_day
-- rows. Called by the sync job after every batch of upserts.
create or replace function bf_refresh_movies(p_slugs text[]) returns void
language sql as $$
  insert into bf_movie as m (
    slug, title, languages, formats, release_date, premiere_date, carried_over, first_date, last_date, days_tracked,
    total_gross, total_sold, total_shows, total_seats, latest, best, advance, advance_date,
    source_updated, updated_at
  )
  select
    s.slug,
    (select d.title from bf_movie_day d where d.slug = s.slug order by d.date desc limit 1),
    array(
      select l->>'name' from bf_movie_day d, jsonb_array_elements(d.lang_list) l
      where d.slug = s.slug group by 1 order by sum((l->>'gross')::numeric) desc
    ),
    array(
      select f->>'name' from bf_movie_day d, jsonb_array_elements(d.format_list) f
      where d.slug = s.slug group by 1 order by sum((f->>'gross')::numeric) desc
    ),
    case
      when bo.first_date <= date '2025-01-01' then null      -- released before the archive starts: unknown
      else coalesce(pr.d1, adv.first_adv)
    end,
    case when bo.first_date > date '2025-01-01' then pr.d0 end,
    coalesce(bo.first_date <= date '2025-01-01', false),
    bo.first_date,
    bo.last_date,
    coalesce(bo.days, 0),
    coalesce(bo.total_gross, 0),
    coalesce(bo.total_sold, 0),
    coalesce(bo.total_shows, 0),
    coalesce(bo.total_seats, 0),
    (select jsonb_build_object('date', d.date) || d.totals from bf_movie_day d
      where d.slug = s.slug and d.kind = 'boxoffice' order by d.date desc limit 1),
    (select jsonb_build_object('date', d.date) || d.totals from bf_movie_day d
      where d.slug = s.slug and d.kind = 'boxoffice' order by (d.totals->>'gross')::numeric desc, d.date limit 1),
    -- The advance figure worth showing: release-day bookings for a film
    -- not yet released, tomorrow's bookings for one already running
    -- (falling back to the latest advance date if none are upcoming).
    coalesce(
      (select jsonb_build_object('date', d.date) || d.totals from bf_movie_day d
        where d.slug = s.slug and d.kind = 'advance'
          and d.date >= (now() at time zone 'Asia/Kolkata')::date + case when bo.first_date is null then 0 else 1 end
        order by d.date asc limit 1),
      (select jsonb_build_object('date', d.date) || d.totals from bf_movie_day d
        where d.slug = s.slug and d.kind = 'advance' order by d.date desc limit 1)
    ),
    adv.last_adv,
    (select d.source_updated from bf_movie_day d where d.slug = s.slug order by d.synced_at desc limit 1),
    now()
  from unnest(p_slugs) as s(slug)
  left join lateral (
    select min(d.date) as first_date, max(d.date) as last_date, count(*) as days,
           sum((d.totals->>'gross')::numeric) as total_gross,
           sum((d.totals->>'sold')::bigint) as total_sold,
           sum((d.totals->>'shows')::bigint) as total_shows,
           sum((d.totals->>'totalSeats')::bigint) as total_seats
    from bf_movie_day d where d.slug = s.slug and d.kind = 'boxoffice'
  ) bo on true
  left join lateral (
    select min(d.date) as first_adv, max(d.date) as last_adv
    from bf_movie_day d where d.slug = s.slug and d.kind = 'advance'
  ) adv on true
  -- Day 1 (release date): the day show counts jump -- the largest
  -- day-over-day rise (at least 3x) among the film's first 21 box-office
  -- days, counting only days with at least 5% of the peak show count. If
  -- there is no such jump (a film already big on its first listed day, or
  -- a slow-burn opener) it's the first day with at least 5% of peak. If
  -- the chosen day still has under 20% of the next day's shows it was a
  -- preview day, and the next day is Day 1. BFILMY lists stray shows days
  -- before most releases; those count in totals but aren't Day 1.
  -- Checked against 38 films with known release dates: 37 match; the
  -- miss (Laalo) has 0 shows in BFILMY's data on its real release day.
  -- d0 = the day just before Day 1, if it had shows ("Day 0 (Pre-release)").
  left join lateral (
    with early as (
      select x.date, (x.totals->>'shows')::numeric as shows, row_number() over (order by x.date) as rn
      from (select d.date, d.totals from bf_movie_day d where d.slug = s.slug and d.kind = 'boxoffice' order by d.date limit 21) x
    ),
    pk as (select max(shows) as peak from early),
    jumps as (
      select e.date, e.shows / greatest(p.shows, 1) as j
      from early e join early p on p.rn = e.rn - 1 and e.date = p.date + 1, pk
      where e.shows >= 0.05 * pk.peak
    ),
    best as (select date, j from jumps order by j desc, date limit 1),
    base as (
      select case
        when (select j from best) >= 3 then (select date from best)
        else (select min(e.date) from early e, pk where e.shows >= 0.05 * pk.peak)
      end as r
    ),
    fwd as (
      select case when nx.date = b.r + 1 and cur.shows < 0.2 * nx.shows then nx.date else b.r end as rel
      from base b
      left join early cur on cur.date = b.r
      left join lateral (select e.date, e.shows from early e where e.date > b.r order by e.date limit 1) nx on true
    )
    select fwd.rel as d1, (select e.date from early e where e.date = fwd.rel - 1) as d0
    from fwd
  ) pr on true
  where exists (select 1 from bf_movie_day d where d.slug = s.slug)
  on conflict (slug) do update set
    title = excluded.title,
    languages = excluded.languages,
    formats = excluded.formats,
    release_date = excluded.release_date,
    premiere_date = excluded.premiere_date,
    carried_over = excluded.carried_over,
    first_date = excluded.first_date,
    last_date = excluded.last_date,
    days_tracked = excluded.days_tracked,
    total_gross = excluded.total_gross,
    total_sold = excluded.total_sold,
    total_shows = excluded.total_shows,
    total_seats = excluded.total_seats,
    latest = excluded.latest,
    best = excluded.best,
    advance = excluded.advance,
    advance_date = excluded.advance_date,
    source_updated = excluded.source_updated,
    updated_at = now();
$$;

-- Every day's row for one movie, with city/chain lists cut to the top N
-- (they're sorted by gross when stored) so a long-running movie's page
-- doesn't pull megabytes.
create or replace function bf_movie_days(p_slug text, p_city_limit int default 50, p_chain_limit int default 30)
returns table (kind text, date date, totals jsonb, breakdown jsonb, source_updated text)
language sql stable as $$
  select d.kind, d.date, d.totals,
    jsonb_build_object(
      'entries', coalesce(d.breakdown->'entries', '[]'::jsonb),
      'states', coalesce(d.breakdown->'states', '[]'::jsonb),
      'formats', coalesce(d.breakdown->'formats', '[]'::jsonb),
      'languages', coalesce(d.breakdown->'languages', '[]'::jsonb),
      'cities', coalesce((select jsonb_agg(x.v order by x.i) from jsonb_array_elements(d.breakdown->'cities') with ordinality x(v, i) where x.i <= p_city_limit), '[]'::jsonb),
      'chains', coalesce((select jsonb_agg(x.v order by x.i) from jsonb_array_elements(d.breakdown->'chains') with ordinality x(v, i) where x.i <= p_chain_limit), '[]'::jsonb)
    ),
    d.source_updated
  from bf_movie_day d
  where d.slug = p_slug
  order by d.kind, d.date;
$$;

-- Exact all-days totals for one movie's box-office run, summed in the
-- database from every day's full lists.
create or replace function bf_movie_cumulative(p_slug text, p_city_limit int default 100, p_chain_limit int default 50)
returns jsonb
language sql stable as $$
  with days as (
    select breakdown from bf_movie_day where slug = p_slug and kind = 'boxoffice'
  ),
  named as (
    select 'states' as list, r->>'name' as name, r from days, jsonb_array_elements(days.breakdown->'states') r
    union all
    select 'formats', r->>'name', r from days, jsonb_array_elements(days.breakdown->'formats') r
    union all
    select 'languages', r->>'name', r from days, jsonb_array_elements(days.breakdown->'languages') r
  ),
  named_sum as (
    select list, name,
      sum((r->>'gross')::numeric) as gross, sum((r->>'sold')::numeric) as sold,
      sum((r->>'shows')::numeric) as shows, sum((r->>'totalSeats')::numeric) as seats,
      sum((r->>'fastfilling')::numeric) as ff, sum((r->>'housefull')::numeric) as hf
    from named group by list, name
  ),
  city_sum as (
    select c->>0 as name, c->>1 as state,
      sum((c->>2)::numeric) as gross, sum((c->>3)::numeric) as sold, sum((c->>4)::numeric) as shows,
      sum((c->>5)::numeric) as seats, sum((c->>6)::numeric) as ff, sum((c->>7)::numeric) as hf
    from days, jsonb_array_elements(days.breakdown->'cities') c group by 1, 2
  ),
  chain_sum as (
    select c->>0 as name,
      sum((c->>1)::numeric) as gross, sum((c->>2)::numeric) as sold, sum((c->>3)::numeric) as shows,
      sum((c->>4)::numeric) as seats, sum((c->>5)::numeric) as ff, sum((c->>6)::numeric) as hf
    from days, jsonb_array_elements(days.breakdown->'chains') c group by 1
  )
  select jsonb_build_object(
    'states', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'gross', gross, 'sold', sold, 'shows', shows, 'totalSeats', seats, 'fastfilling', ff, 'housefull', hf) order by gross desc), '[]'::jsonb) from named_sum where list = 'states'),
    'formats', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'gross', gross, 'sold', sold, 'shows', shows, 'totalSeats', seats, 'fastfilling', ff, 'housefull', hf) order by gross desc), '[]'::jsonb) from named_sum where list = 'formats'),
    'languages', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'gross', gross, 'sold', sold, 'shows', shows, 'totalSeats', seats, 'fastfilling', ff, 'housefull', hf) order by gross desc), '[]'::jsonb) from named_sum where list = 'languages'),
    'cities', (select coalesce(jsonb_agg(jsonb_build_array(name, state, gross, sold, shows, seats, ff, hf) order by gross desc), '[]'::jsonb) from (select * from city_sum order by gross desc limit p_city_limit) t),
    'chains', (select coalesce(jsonb_agg(jsonb_build_array(name, gross, sold, shows, seats, ff, hf) order by gross desc), '[]'::jsonb) from (select * from chain_sum order by gross desc limit p_chain_limit) t),
    'cityCount', (select count(*) from city_sum),
    'chainCount', (select count(*) from chain_sum)
  );
$$;

-- Advance bookings only matter in full detail until the show date has
-- passed; after 3 days keep just the top 30 cities/chains for each
-- (states/formats/languages stay whole). Keeps the database small.
create or replace function bf_prune_advance() returns int
language sql as $$
  with pruned as (
    update bf_movie_day set
      breakdown = breakdown || jsonb_build_object(
        'cities', coalesce((select jsonb_agg(x.v order by x.i) from jsonb_array_elements(breakdown->'cities') with ordinality x(v, i) where x.i <= 30), '[]'::jsonb),
        'chains', coalesce((select jsonb_agg(x.v order by x.i) from jsonb_array_elements(breakdown->'chains') with ordinality x(v, i) where x.i <= 30), '[]'::jsonb)
      ),
      pruned = true
    where kind = 'advance' and not pruned and date < (now() at time zone 'Asia/Kolkata')::date - 3
    returning 1
  )
  select count(*)::int from pruned;
$$;

-- Read functions are public; the write/maintenance ones are service-role only.
grant execute on function bf_movie_days(text, int, int) to anon, authenticated;
grant execute on function bf_movie_cumulative(text, int, int) to anon, authenticated;
revoke execute on function bf_refresh_movies(text[]) from public, anon, authenticated;
revoke execute on function bf_prune_advance() from public, anon, authenticated;
