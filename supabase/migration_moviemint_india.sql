-- MovieMint India + BFILMY USA source policy (Oct 2026).
--
-- Run once in the Supabase SQL Editor, after every earlier migration in
-- this folder. Safe to re-run: every statement is guarded. ADDITIVE ONLY --
-- nothing here alters, rewrites or deletes an existing table's rows
-- (bf_*, us_*, fyre_tracked_movie, mm_movie stay exactly as they are).
--
-- Nothing reads these tables until FYRE_SOURCE_POLICY=moviemint_india is
-- set, and nothing writes them until MOVIEMINT_INDIA_SYNC=1 (or the local
-- script scripts/moviemint-india.ts runs). Switching the policy back off
-- returns the site to the BFILMY India tables untouched.
--
--   mmi_catalog    MovieMint movie -> canonical Fyre movie (+ public slug).
--                  Under the policy this IS the public catalog.
--   mmi_movie_day  One row per movie x kind x date, MovieMint India only.
--                  Same column layout as bf_movie_day (totals / breakdown
--                  JSON, same tuple positions) so every existing reader and
--                  SQL helper works on it unchanged.
--   mmi_movie      Per-movie summary, same columns as bf_movie.
--   mmi_fetch      Which MovieMint pages were fetched, when, and how it went
--                  (drives pacing and the admin status panel).

-- ---------------------------------------------------------------------------
-- 1. Catalog link
-- ---------------------------------------------------------------------------
create table if not exists mmi_catalog (
  moviemint_id text primary key,               -- MovieMint boxOfficeId (mm_movie.moviemint_id)
  movie_id text,                               -- canonical Fyre id (fyre_tracked_movie.moviemint_id)
  slug text,                                   -- public URL slug under the policy
  link_status text not null default 'needs_review',
  link_method text,                            -- same_id | title_date | created | admin
  link_note text,
  candidates jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table mmi_catalog drop constraint if exists mmi_catalog_link_status_check;
alter table mmi_catalog add constraint mmi_catalog_link_status_check
  check (link_status in ('linked', 'needs_review', 'excluded'));
create unique index if not exists mmi_catalog_slug_uidx on mmi_catalog (slug) where link_status = 'linked';
create unique index if not exists mmi_catalog_movie_uidx on mmi_catalog (movie_id) where link_status = 'linked';

-- fyre_movie_alias / fyre_tracked_movie already allow source/origin
-- 'moviemint'; nothing to change there.

-- MovieMint lists upcoming releases on /advance (not /tracked). on_list
-- keeps its meaning (on /tracked); on_advance marks /advance listings.
alter table mm_movie add column if not exists on_advance boolean not null default false;
alter table mm_movie add column if not exists advance_seen_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Per-day India data (MovieMint)
-- ---------------------------------------------------------------------------
create table if not exists mmi_movie_day (
  slug text not null,
  moviemint_id text not null,
  kind text not null,
  date date not null,
  title text not null,
  totals jsonb not null,
  breakdown jsonb not null default '{}'::jsonb,
  -- none  = totals only (MovieMint's day series); breakdowns not imported
  -- live  = breakdown snapshot taken while the day was still running
  -- final = breakdown fetched after the day ended
  breakdown_status text not null default 'none',
  -- true once this date was older than the breakdown retention window and
  -- its lists were trimmed (same meaning as bf_movie_day.breakdown_pruned)
  breakdown_pruned boolean not null default false,
  source_updated text,                         -- MovieMint "lastUpdated" for the figures
  in_source boolean not null default true,     -- false: MovieMint's latest series no longer lists this date (kept, flagged)
  totals_synced_at timestamptz,
  breakdown_synced_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (slug, kind, date)
);
alter table mmi_movie_day drop constraint if exists mmi_movie_day_kind_check;
alter table mmi_movie_day add constraint mmi_movie_day_kind_check check (kind in ('boxoffice', 'advance'));
alter table mmi_movie_day drop constraint if exists mmi_movie_day_breakdown_status_check;
alter table mmi_movie_day add constraint mmi_movie_day_breakdown_status_check check (breakdown_status in ('none', 'live', 'final'));
create index if not exists mmi_movie_day_kind_date_idx on mmi_movie_day (kind, date);
create index if not exists mmi_movie_day_mm_idx on mmi_movie_day (moviemint_id);

-- ---------------------------------------------------------------------------
-- 3. Per-movie summary (same columns as bf_movie)
-- ---------------------------------------------------------------------------
create table if not exists mmi_movie (
  slug text primary key,
  moviemint_id text not null,
  title text not null,
  languages text[] not null default '{}',
  formats text[] not null default '{}',
  poster text,
  release_date date,
  premiere_date date,
  carried_over boolean not null default false,
  first_date date,
  last_date date,
  days_tracked int not null default 0,
  total_gross numeric not null default 0,
  total_sold bigint not null default 0,
  total_shows bigint not null default 0,
  total_seats bigint not null default 0,
  latest jsonb,
  best jsonb,
  advance jsonb,
  advance_date date,
  source_updated text,
  breakdown_days int not null default 0,       -- box-office days with a final breakdown
  missing_dates date[] not null default '{}',  -- gaps inside the run MovieMint has no figures for
  available_dates date[] not null default '{}',-- dates MovieMint offers a per-date page for
  updated_at timestamptz not null default now()
);
create unique index if not exists mmi_movie_mm_uidx on mmi_movie (moviemint_id);

-- ---------------------------------------------------------------------------
-- 4. Fetch log
-- ---------------------------------------------------------------------------
create table if not exists mmi_fetch (
  moviemint_id text not null,
  page text not null,                          -- series | advance | date:YYYY-MM-DD | advance:YYYY-MM-DD
  fetched_at timestamptz not null default now(),
  ok boolean not null,
  error text,
  source_updated text,
  primary key (moviemint_id, page)
);

-- ---------------------------------------------------------------------------
-- 5. Read access (same as the bf_* tables: public read, service-role write)
-- ---------------------------------------------------------------------------
alter table mmi_catalog enable row level security;
alter table mmi_movie_day enable row level security;
alter table mmi_movie enable row level security;
alter table mmi_fetch enable row level security;
drop policy if exists "mmi_catalog public read" on mmi_catalog;
create policy "mmi_catalog public read" on mmi_catalog for select using (true);
drop policy if exists "mmi_movie_day public read" on mmi_movie_day;
create policy "mmi_movie_day public read" on mmi_movie_day for select using (true);
drop policy if exists "mmi_movie public read" on mmi_movie;
create policy "mmi_movie public read" on mmi_movie for select using (true);
-- mmi_fetch: no public policy (admin/service role only).

-- ---------------------------------------------------------------------------
-- 6. SQL helpers -- copies of the bf_* read helpers over mmi_movie_day.
--    Same arguments, same output shapes, same tuple positions:
--      city:  [name, state, gross, sold, shows, totalSeats, fastfilling, housefull, venues]
--      chain: [name, gross, sold, shows, totalSeats, fastfilling, housefull]  (MovieMint: none)
-- ---------------------------------------------------------------------------
create or replace function mmi_movie_days(p_slug text, p_city_limit int default 50, p_chain_limit int default 30)
returns table (kind text, date date, totals jsonb, breakdown jsonb, source_updated text)
language sql stable as $$
  select d.kind, d.date, d.totals,
    jsonb_build_object(
      'entries', '[]'::jsonb,
      'states', coalesce(d.breakdown->'states', '[]'::jsonb),
      'formats', coalesce(d.breakdown->'formats', '[]'::jsonb),
      'languages', coalesce(d.breakdown->'languages', '[]'::jsonb),
      'cities', coalesce((select jsonb_agg(x.v order by x.i) from jsonb_array_elements(d.breakdown->'cities') with ordinality x(v, i) where x.i <= p_city_limit), '[]'::jsonb),
      'chains', '[]'::jsonb
    ),
    d.source_updated
  from mmi_movie_day d
  where d.slug = p_slug and d.in_source
  order by d.kind, d.date;
$$;

create or replace function mmi_movie_cumulative(p_slug text, p_city_limit int default 100, p_chain_limit int default 50)
returns jsonb
language sql stable as $$
  with days as (
    select breakdown from mmi_movie_day where slug = p_slug and kind = 'boxoffice' and breakdown_status <> 'none' and in_source
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
  )
  select jsonb_build_object(
    'states', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'gross', gross, 'sold', sold, 'shows', shows, 'totalSeats', seats, 'fastfilling', ff, 'housefull', hf) order by gross desc), '[]'::jsonb) from named_sum where list = 'states'),
    'formats', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'gross', gross, 'sold', sold, 'shows', shows, 'totalSeats', seats, 'fastfilling', ff, 'housefull', hf) order by gross desc), '[]'::jsonb) from named_sum where list = 'formats'),
    'languages', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'gross', gross, 'sold', sold, 'shows', shows, 'totalSeats', seats, 'fastfilling', ff, 'housefull', hf) order by gross desc), '[]'::jsonb) from named_sum where list = 'languages'),
    'cities', (select coalesce(jsonb_agg(jsonb_build_array(name, state, gross, sold, shows, seats, ff, hf) order by gross desc), '[]'::jsonb) from (select * from city_sum order by gross desc limit p_city_limit) t),
    'chains', '[]'::jsonb,
    'cityCount', (select count(*) from city_sum),
    'chainCount', 0
  );
$$;

create or replace function mmi_summary_dim_sum(p_slug text, p_kind text, p_dates date[], p_list text, p_limit int default null)
returns jsonb
language sql stable as $$
  with d as (
    select date, breakdown from mmi_movie_day
    where slug = p_slug and kind = p_kind and date = any(p_dates) and breakdown_status <> 'none' and in_source
  ),
  r as (
    select d.date,
      case when p_list = 'cities' then jsonb_build_array(e.v->>0, e.v->>1) else jsonb_build_array(e.v->>'name') end as k,
      case when p_list = 'cities' then (e.v->>4)::numeric else (e.v->>'shows')::numeric end as shows,
      case when p_list = 'cities' then (e.v->>5)::numeric else (e.v->>'totalSeats')::numeric end as seats,
      case when p_list = 'cities' then (e.v->>3)::numeric else (e.v->>'sold')::numeric end as sold,
      case when p_list = 'cities' then (e.v->>2)::numeric else (e.v->>'gross')::numeric end as gross,
      case when p_list = 'cities' then (e.v->>6)::numeric else (e.v->>'fastfilling')::numeric end as ff,
      case when p_list = 'cities' then (e.v->>7)::numeric else (e.v->>'housefull')::numeric end as hf,
      case when p_list = 'cities' then (e.v->>8)::numeric else (e.v->>'venues')::numeric end as venues
    from d, jsonb_array_elements(d.breakdown->p_list) e(v)
    where p_list in ('states', 'languages', 'formats', 'cities', 'territories')
  ),
  n as (select count(distinct date) as days from r),
  g as (
    select k, sum(shows) shows, sum(seats) seats, sum(sold) sold, sum(gross) gross, sum(ff) ff, sum(hf) hf, max(venues) venues
    from r group by k
  )
  select jsonb_build_object(
    'days', (select days from n),
    'total', (select count(*) from g),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_array(k, shows, seats, sold, gross, ff, hf,
        case when (select days from n) = 1 then venues end, null) order by gross desc, sold desc, k::text)
      from (select * from g order by gross desc, sold desc, k::text limit coalesce(p_limit, 2147483647)) x
    ), '[]'::jsonb)
  );
$$;

-- Trims city lists of MovieMint days older than p_keep_days (states,
-- languages, formats and every day's totals stay). Not scheduled by
-- default; called only when BF_RETENTION_ENABLED=1 like the bf_* pruning.
create or replace function mmi_prune_breakdowns(p_keep_days int default 90, p_dry_run boolean default true)
returns jsonb
language plpgsql as $$
declare
  cutoff date := (now() at time zone 'Asia/Kolkata')::date - p_keep_days;
  n int;
begin
  select count(*) into n from mmi_movie_day where date < cutoff and not breakdown_pruned and breakdown_status <> 'none';
  if not p_dry_run then
    update mmi_movie_day set breakdown = breakdown - 'cities', breakdown_pruned = true
    where date < cutoff and not breakdown_pruned and breakdown_status <> 'none';
  end if;
  return jsonb_build_object('cutoff', cutoff, 'days', n, 'dry_run', p_dry_run);
end $$;
revoke execute on function mmi_prune_breakdowns(int, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';
