-- MovieMint India, migration 2 (complete MovieMint data). Oct 2026.
--
-- Run once in the Supabase SQL Editor AFTER migration_moviemint_india.sql.
-- Safe to re-run: every statement is guarded. ADDITIVE ONLY -- it adds one
-- table, columns with defaults and read helpers. No existing row is changed
-- or deleted; bf_*, us_*, fyre_tracked_movie and every BFILMY history row
-- are untouched. Nothing reads these until FYRE_SOURCE_POLICY=moviemint_india
-- and nothing writes them until the MovieMint import runs.
--
-- What it adds (see the "MovieMint Data Discovery Report"):
--   1. mmi_movie_day.day_window     'tracked' = inside MovieMint's official
--                                   tracking window; 'later' = a day MovieMint
--                                   captured after that window and leaves out
--                                   of its own totals
--   2. mmi_snapshot                 every live-day and advance refresh, kept
--                                   as it happened (intraday + build-up charts)
--   3. mmi_movie: cumulative report, MovieMint's official window totals,
--                 tracked/later split, extended metadata
--   4. mm_movie: sitemap eligibility + the whole list entry
--   5. read helpers: day list / window breakdown limited to the tracked
--      window, city x format sums, snapshot series

-- ---------------------------------------------------------------------------
-- 1. Tracked window vs later days
-- ---------------------------------------------------------------------------
alter table mmi_movie_day add column if not exists day_window text not null default 'tracked';
alter table mmi_movie_day drop constraint if exists mmi_movie_day_window_check;
alter table mmi_movie_day add constraint mmi_movie_day_window_check check (day_window in ('tracked', 'later'));
create index if not exists mmi_movie_day_slug_window_idx on mmi_movie_day (slug, kind, day_window, date);

-- ---------------------------------------------------------------------------
-- 2. Snapshots (live day + advance), one row per MovieMint refresh
-- ---------------------------------------------------------------------------
create table if not exists mmi_snapshot (
  moviemint_id text not null,
  slug text not null,
  kind text not null,
  show_date date not null,                     -- the show date the figures are for
  source_updated text not null,                -- MovieMint stamp, e.g. '2026-10-14 20:40 IST'
  completed_as_of text,                        -- live day: shows counted up to this time
  captured_at timestamptz not null default now(),
  totals jsonb not null,                       -- gross, sold, shows, totalSeats, occupancy, occupancySource, venues, ff, hf
  states jsonb,                                -- [[name, gross, sold, shows, seats], ...]
  primary key (moviemint_id, kind, show_date, source_updated)
);
alter table mmi_snapshot drop constraint if exists mmi_snapshot_kind_check;
alter table mmi_snapshot add constraint mmi_snapshot_kind_check check (kind in ('boxoffice', 'advance'));
create index if not exists mmi_snapshot_slug_idx on mmi_snapshot (slug, kind, show_date, captured_at);

-- ---------------------------------------------------------------------------
-- 3. Per-movie: cumulative report, official totals, tracked/later split, meta
-- ---------------------------------------------------------------------------
alter table mmi_movie add column if not exists cumulative jsonb;              -- MovieMint's "Cumulative - All Days" report (whole tracked window)
alter table mmi_movie add column if not exists cumulative_updated text;       -- its MovieMint stamp
alter table mmi_movie add column if not exists official jsonb;                -- MovieMint's own window totals + top state (/tracked list)
alter table mmi_movie add column if not exists meta jsonb not null default '{}'::jsonb; -- backdrop, genres, tmdbId, note, badge, flags, advance dates, latest snapshot date
alter table mmi_movie add column if not exists window_start date;
alter table mmi_movie add column if not exists window_end date;
alter table mmi_movie add column if not exists tracked_days int not null default 0;
alter table mmi_movie add column if not exists later_days int not null default 0;
alter table mmi_movie add column if not exists later_gross numeric not null default 0;
alter table mmi_movie add column if not exists later_sold bigint not null default 0;
alter table mmi_movie add column if not exists later_first date;
alter table mmi_movie add column if not exists later_last date;

-- ---------------------------------------------------------------------------
-- 4. MovieMint list membership
-- ---------------------------------------------------------------------------
alter table mm_movie add column if not exists on_sitemap boolean not null default false;
alter table mm_movie add column if not exists sitemap_seen_at timestamptz;
alter table mm_movie add column if not exists listing jsonb;                  -- the whole /tracked or /advance entry, as published

-- ---------------------------------------------------------------------------
-- 5. Read access + helpers
-- ---------------------------------------------------------------------------
alter table mmi_snapshot enable row level security;
drop policy if exists "mmi_snapshot public read" on mmi_snapshot;
create policy "mmi_snapshot public read" on mmi_snapshot for select using (true);

-- The migration-1 read helpers, redefined (same arguments, same output) so
-- that every existing reader keeps MovieMint's official tracked window:
-- later days are never part of a movie's day list or window breakdown.
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
  where d.slug = p_slug and d.in_source and (d.kind <> 'boxoffice' or d.day_window = 'tracked')
  order by d.kind, d.date;
$$;

create or replace function mmi_movie_cumulative(p_slug text, p_city_limit int default 100, p_chain_limit int default 50)
returns jsonb
language sql stable as $$
  with days as (
    select breakdown from mmi_movie_day where slug = p_slug and kind = 'boxoffice' and breakdown_status <> 'none' and in_source and day_window = 'tracked'
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

-- City x format gross over a set of dates. City tuples carry their format
-- split at position 11 as [[format, gross], ...] (MovieMint gives gross
-- only for this split -- no tickets or shows).
-- Returns {days, total, rows: [[city, state, format, gross], ...]} by gross.
create or replace function mmi_city_format_sum(p_slug text, p_kind text, p_dates date[], p_state text default null, p_format text default null)
returns jsonb
language sql stable as $$
  with d as (
    select date, breakdown from mmi_movie_day
    where slug = p_slug and kind = p_kind and date = any(p_dates) and breakdown_status <> 'none' and in_source
  ),
  r as (
    select c.v->>0 as city, c.v->>1 as state, f.v->>0 as format, (f.v->>1)::numeric as gross, d.date
    from d, jsonb_array_elements(d.breakdown->'cities') c(v), jsonb_array_elements(coalesce(c.v->11, '[]'::jsonb)) f(v)
    where (p_state is null or c.v->>1 = p_state) and (p_format is null or f.v->>0 = p_format)
  ),
  g as (select city, state, format, sum(gross) as gross from r group by 1, 2, 3)
  select jsonb_build_object(
    'days', (select count(distinct date) from r),
    'total', (select count(*) from g),
    'rows', coalesce((select jsonb_agg(jsonb_build_array(city, state, format, gross) order by gross desc, city, format) from g), '[]'::jsonb)
  );
$$;

-- Snapshot series of one show date (live day or advance), oldest first.
create or replace function mmi_snapshot_series(p_slug text, p_kind text, p_show_date date)
returns table (source_updated text, completed_as_of text, captured_at timestamptz, totals jsonb)
language sql stable as $$
  select s.source_updated, s.completed_as_of, s.captured_at, s.totals
  from mmi_snapshot s
  where s.slug = p_slug and s.kind = p_kind and s.show_date = p_show_date
  order by s.captured_at, s.source_updated;
$$;

-- Snapshot retention (not scheduled by default; same switch as the bf_*
-- pruning). Live-day snapshots older than p_live_days go; advance snapshots
-- keep their totals forever and drop their state lists after p_state_days.
create or replace function mmi_prune_snapshots(p_live_days int default 30, p_state_days int default 30, p_dry_run boolean default true)
returns jsonb
language plpgsql as $$
declare
  live_cut timestamptz := now() - make_interval(days => p_live_days);
  state_cut timestamptz := now() - make_interval(days => p_state_days);
  n_live int;
  n_states int;
begin
  select count(*) into n_live from mmi_snapshot where kind = 'boxoffice' and captured_at < live_cut;
  select count(*) into n_states from mmi_snapshot where kind = 'advance' and captured_at < state_cut and states is not null;
  if not p_dry_run then
    delete from mmi_snapshot where kind = 'boxoffice' and captured_at < live_cut;
    update mmi_snapshot set states = null where kind = 'advance' and captured_at < state_cut and states is not null;
  end if;
  return jsonb_build_object('live_deleted', n_live, 'advance_states_cleared', n_states, 'dry_run', p_dry_run);
end $$;
revoke execute on function mmi_prune_snapshots(int, int, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';
