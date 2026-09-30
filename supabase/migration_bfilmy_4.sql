-- BFILMY show-level data (finaldetailed.json) -> permanent aggregates.
-- Additive only: no existing table or column is changed or dropped.
-- Safe to run more than once.
--
-- Tuple layout used by bf_movie_breakdown.rows (see lib/bfilmy/detail.ts):
--   [key[], shows, seats, sold, gross, ff, hf, venues, cities]
-- show_hour rows add [cumulative venues, cumulative cities] at 9 and 10.
-- In the "venue" dimension, key = [bf_venue.id].

-- 1. Venue dictionary: one row per cinema (name + city + state), so the
--    permanent venue tables store a small id instead of the full name.
create table if not exists bf_venue (
  id bigserial primary key,
  venue_key text not null unique,          -- "name|city|state"
  name text not null,
  city text not null,
  state text not null,
  chain text,
  source_venue_id text,
  first_seen date,
  last_seen date,
  updated_at timestamptz not null default now()
);

-- 2. Per movie per day summary computed from the show rows. Kept forever.
create table if not exists bf_movie_day_detail (
  slug text not null,
  kind text not null check (kind in ('boxoffice', 'advance')),
  date date not null,
  title text not null,
  languages text[] not null default '{}',
  shows integer not null,
  seats bigint not null,
  sold bigint not null,
  gross numeric(16, 2) not null,
  ff integer not null,
  hf integer not null,
  venues integer not null,
  cities integer not null,
  states integer not null,
  pic jsonb not null,                      -- {shows, seats, sold, gross, ff, hf, venues, cities}
  source_url text,
  source_updated text,
  synced_at timestamptz not null default now(),
  primary key (slug, kind, date)
);
create index if not exists bf_movie_day_detail_date_idx on bf_movie_day_detail (kind, date);

-- 3. Per movie per day per dimension aggregates. Kept forever.
--    dimension: venue | language | format | language_state | language_city |
--               show_hour | price_band
create table if not exists bf_movie_breakdown (
  slug text not null,
  kind text not null check (kind in ('boxoffice', 'advance')),
  date date not null,
  dimension text not null,
  rows jsonb not null,
  method text not null default 'derived from BFILMY show rows',
  source_url text,
  source_updated text,
  synced_at timestamptz not null default now(),
  primary key (slug, kind, date, dimension)
);
create index if not exists bf_movie_breakdown_date_idx on bf_movie_breakdown (kind, date);

-- 4. One row per imported show-level file: where it came from, whether
--    it matched the summary file, and whether the permanent aggregates
--    for that date are complete (pruning show rows requires that).
create table if not exists bf_detail_file (
  kind text not null check (kind in ('boxoffice', 'advance')),
  date date not null,
  source_url text,
  source_updated text,
  summary_updated text,
  movies integer not null default 0,
  shows_total integer not null default 0,
  shows_stored integer not null default 0,
  reconcile_issues jsonb not null default '[]'::jsonb,
  aggregates_complete boolean not null default false,
  final boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (kind, date)
);

-- 5. Raw show rows for drilldown, kept only for a short window (see
--    bf_prune_shows). Nothing permanent is ever computed from this table.
create table if not exists bf_show (
  id bigserial primary key,
  kind text not null check (kind in ('boxoffice', 'advance')),
  date date not null,
  slug text not null,
  format text not null,
  language text not null,
  venue_id bigint not null references bf_venue (id),
  show_time text not null,
  hour smallint,
  audi text,
  session_id text,
  seats integer not null,
  available integer,
  sold integer not null,
  gross numeric(12, 2) not null,
  source_flag text
);
create index if not exists bf_show_movie_idx on bf_show (slug, kind, date);
create index if not exists bf_show_date_idx on bf_show (kind, date);

alter table bf_venue enable row level security;
alter table bf_movie_day_detail enable row level security;
alter table bf_movie_breakdown enable row level security;
alter table bf_detail_file enable row level security;
alter table bf_show enable row level security;
drop policy if exists "bf_venue public read" on bf_venue;
create policy "bf_venue public read" on bf_venue for select using (true);
drop policy if exists "bf_movie_day_detail public read" on bf_movie_day_detail;
create policy "bf_movie_day_detail public read" on bf_movie_day_detail for select using (true);
drop policy if exists "bf_movie_breakdown public read" on bf_movie_breakdown;
create policy "bf_movie_breakdown public read" on bf_movie_breakdown for select using (true);
drop policy if exists "bf_detail_file public read" on bf_detail_file;
create policy "bf_detail_file public read" on bf_detail_file for select using (true);
drop policy if exists "bf_show public read" on bf_show;
create policy "bf_show public read" on bf_show for select using (true);

-- Sums one stored dimension over a set of dates. Distinct venue/city
-- counts can't be added across days, so they're only returned for a
-- single date (null otherwise). Returns {rows, total, days}.
create or replace function bf_dim_sum(p_slug text, p_kind text, p_dates date[], p_dimension text, p_limit int default null)
returns jsonb
language sql stable as $$
  with r as (
    select b.date, e.v
    from bf_movie_breakdown b, jsonb_array_elements(b.rows) e(v)
    where b.slug = p_slug and b.kind = p_kind and b.date = any(p_dates) and b.dimension = p_dimension
  ),
  n as (select count(distinct date) as days from r),
  g as (
    select v->0 as k,
      sum((v->>1)::numeric) as shows, sum((v->>2)::numeric) as seats, sum((v->>3)::numeric) as sold,
      sum((v->>4)::numeric) as gross, sum((v->>5)::numeric) as ff, sum((v->>6)::numeric) as hf,
      max((v->>7)::numeric) as venues, max((v->>8)::numeric) as cities,
      max((v->>9)::numeric) as cumv, max((v->>10)::numeric) as cumc
    from r group by v->0
  )
  select jsonb_build_object(
    'days', (select days from n),
    'total', (select count(*) from g),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_array(k, shows, seats, sold, gross, ff, hf,
        case when (select days from n) = 1 then venues end,
        case when (select days from n) = 1 then cities end,
        case when (select days from n) = 1 then cumv end,
        case when (select days from n) = 1 then cumc end) order by gross desc, sold desc, k::text)
      from (select * from g order by gross desc, sold desc, k::text limit coalesce(p_limit, 2147483647)) x
    ), '[]'::jsonb)
  );
$$;

-- Rolls the venue dimension up by state / city / chain / venue / total,
-- optionally PIC chains only. Venue and city counts here are exact over
-- any set of dates (distinct venues, not a sum). Returns {rows, total, days}.
create or replace function bf_venue_rollup(p_slug text, p_kind text, p_dates date[], p_by text, p_pic_only boolean default false, p_limit int default null)
returns jsonb
language sql stable as $$
  with r as (
    select b.date, (e.v->0->>0)::bigint as vid, e.v
    from bf_movie_breakdown b, jsonb_array_elements(b.rows) e(v)
    where b.slug = p_slug and b.kind = p_kind and b.date = any(p_dates) and b.dimension = 'venue'
  ),
  j as (
    select r.*, bv.name, bv.city, bv.state, coalesce(nullif(bv.chain, ''), 'Unknown') as chain
    from r join bf_venue bv on bv.id = r.vid
    where not p_pic_only or bv.chain in ('PVR', 'INOX', 'Cinepolis')
  ),
  g as (
    select
      case p_by
        when 'state' then jsonb_build_array(state)
        when 'city' then jsonb_build_array(city, state)
        when 'chain' then jsonb_build_array(chain)
        when 'venue' then jsonb_build_array(vid, name, city, state, chain)
        else '[]'::jsonb
      end as k,
      sum((v->>1)::numeric) as shows, sum((v->>2)::numeric) as seats, sum((v->>3)::numeric) as sold,
      sum((v->>4)::numeric) as gross, sum((v->>5)::numeric) as ff, sum((v->>6)::numeric) as hf,
      count(distinct vid) as venues, count(distinct city || '|' || state) as cities,
      count(distinct state) as states
    from j group by 1
  )
  select jsonb_build_object(
    'days', (select count(distinct date) from r),
    'total', (select count(*) from g),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_array(k, shows, seats, sold, gross, ff, hf,
        case when p_by = 'venue' then null else venues end,
        case when p_by in ('venue', 'city') then null else cities end,
        states) order by gross desc, sold desc, k::text)
      from (select * from g order by gross desc, sold desc, k::text limit coalesce(p_limit, 2147483647)) x
    ), '[]'::jsonb)
  );
$$;

-- Sums one of the summary file's lists (bf_movie_day.breakdown) over a set
-- of dates, in the same tuple layout: states / languages / formats (named
-- rows), cities, chains (tuples). Returns {rows, total, days}.
create or replace function bf_summary_dim_sum(p_slug text, p_kind text, p_dates date[], p_list text, p_limit int default null)
returns jsonb
language sql stable as $$
  with d as (
    select date, breakdown from bf_movie_day
    where slug = p_slug and kind = p_kind and date = any(p_dates)
  ),
  r as (
    select d.date,
      case when p_list = 'cities' then jsonb_build_array(e.v->>0, e.v->>1)
           when p_list = 'chains' then jsonb_build_array(e.v->>0)
           else jsonb_build_array(e.v->>'name') end as k,
      case when p_list = 'cities' then (e.v->>4)::numeric when p_list = 'chains' then (e.v->>3)::numeric else (e.v->>'shows')::numeric end as shows,
      case when p_list = 'cities' then (e.v->>5)::numeric when p_list = 'chains' then (e.v->>4)::numeric else (e.v->>'totalSeats')::numeric end as seats,
      case when p_list = 'cities' then (e.v->>3)::numeric when p_list = 'chains' then (e.v->>2)::numeric else (e.v->>'sold')::numeric end as sold,
      case when p_list = 'cities' then (e.v->>2)::numeric when p_list = 'chains' then (e.v->>1)::numeric else (e.v->>'gross')::numeric end as gross,
      case when p_list = 'cities' then (e.v->>6)::numeric when p_list = 'chains' then (e.v->>5)::numeric else (e.v->>'fastfilling')::numeric end as ff,
      case when p_list = 'cities' then (e.v->>7)::numeric when p_list = 'chains' then (e.v->>6)::numeric else (e.v->>'housefull')::numeric end as hf,
      case when p_list = 'cities' then (e.v->>8)::numeric when p_list = 'chains' then (e.v->>7)::numeric else (e.v->>'venues')::numeric end as venues
    from d, jsonb_array_elements(d.breakdown->p_list) e(v)
    where p_list in ('states', 'languages', 'formats', 'cities', 'chains')
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

-- Deletes raw show rows older than p_keep_days -- but only for dates whose
-- permanent aggregates are complete and final. Returns rows deleted (or
-- that would be deleted, with p_dry_run). Nothing calls this automatically
-- until the retention test has passed.
create or replace function bf_prune_shows(p_keep_days int default 7, p_dry_run boolean default true)
returns int
language plpgsql as $$
declare
  n int;
  cutoff date := (now() at time zone 'Asia/Kolkata')::date - p_keep_days;
begin
  if p_dry_run then
    select count(*) into n from bf_show s
    join bf_detail_file f on f.kind = s.kind and f.date = s.date
    where s.date < cutoff and f.aggregates_complete and f.final;
    return n;
  end if;
  with gone as (
    delete from bf_show s using bf_detail_file f
    where f.kind = s.kind and f.date = s.date
      and s.date < cutoff and f.aggregates_complete and f.final
    returning 1
  )
  select count(*) into n from gone;
  update bf_detail_file f set shows_stored = 0
    where f.date < cutoff and f.aggregates_complete and f.final and f.shows_stored > 0;
  return n;
end;
$$;

-- Adds/refreshes venues and returns their ids (sync job only). A venue's
-- chain is taken from the most recent file it appeared in.
create or replace function bf_upsert_venues(p_rows jsonb, p_date date)
returns table (id bigint, venue_key text)
language sql as $$
  insert into bf_venue as v (venue_key, name, city, state, chain, source_venue_id, first_seen, last_seen)
  select r->>'key', r->>'name', r->>'city', r->>'state', nullif(r->>'chain', ''), nullif(r->>'sourceVenueId', ''), p_date, p_date
  from jsonb_array_elements(p_rows) r
  on conflict (venue_key) do update set
    chain = case when p_date >= v.last_seen then coalesce(excluded.chain, v.chain) else v.chain end,
    source_venue_id = coalesce(v.source_venue_id, excluded.source_venue_id),
    first_seen = least(v.first_seen, excluded.first_seen),
    last_seen = greatest(v.last_seen, excluded.last_seen),
    updated_at = now()
  returning v.id, v.venue_key;
$$;

-- Database size, for keeping an eye on the free-plan limit.
create or replace function bf_db_size() returns jsonb
language sql stable security definer as $$
  select jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'tables', (
      select jsonb_object_agg(c.relname, pg_total_relation_size(c.oid))
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public' and c.relkind = 'r'
    )
  );
$$;

grant execute on function bf_dim_sum(text, text, date[], text, int) to anon, authenticated;
grant execute on function bf_venue_rollup(text, text, date[], text, boolean, int) to anon, authenticated;
grant execute on function bf_summary_dim_sum(text, text, date[], text, int) to anon, authenticated;
grant execute on function bf_db_size() to anon, authenticated;
revoke execute on function bf_prune_shows(int, boolean) from public, anon, authenticated;
revoke execute on function bf_upsert_venues(jsonb, date) from public, anon, authenticated;
