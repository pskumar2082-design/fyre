-- USA territory: "USA · Indian-language screenings", from BFILMY's USA feed
-- (usadata<YYYY>.pages.dev). Additive: no India table is touched.
-- Replaces the earlier, never-run draft of this file.
--
-- One Fyre movie, two territories. USA rows are keyed by the canonical
-- Fyre movie (movie_id = fyre_tracked_movie.moviemint_id); there is no
-- separate USA movie or page. Only MovieMint-tracked movies are imported.
--
-- Storage (free plan):
--   us_movie_day         core daily totals .......................... permanent
--   us_movie_breakdown   state/chain/format/language/format x language . 90 days
--                        city/theater ............................... 30 days
--   us_show              raw show rows ....... 7 days + open advance dates
--   us_advance_snapshot  daily advance captures (for DoD) ........... 30 days
-- Full source JSON is never stored; the file URL + ETag are.
--
-- Safe to run more than once.

-- Source movie id (BFILMY USA) -> Fyre movie. Every id seen is listed so
-- the admin can review uncertain ones; only 'matched' rows are imported.
-- Not publicly readable (it names untracked titles).
create table if not exists us_movie_map (
  source_movie_id bigint primary key,
  source text not null default 'BFILMY_USA',
  source_title text not null,
  title_key text not null,
  movie_id text references mm_movie (moviemint_id),
  match_status text not null default 'unmatched' check (match_status in ('matched', 'needs_review', 'unmatched', 'rejected')),
  match_confidence text,
  match_method text,
  match_note text,
  candidates jsonb not null default '[]'::jsonb,
  languages text[],
  first_date date,
  last_date date,
  reviewed_at timestamptz,
  backfill_status text,                  -- 'requested' after a manual match: import its history
  backfill_next date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists us_movie_map_movie_idx on us_movie_map (movie_id);
create index if not exists us_movie_map_status_idx on us_movie_map (match_status);

-- One row per Fyre movie per USA report date (the source file's US
-- business date; after-midnight shows belong to the previous date).
-- kind = boxoffice (that date's shows) or advance (pre-sales for shows on
-- that date; never added to box office).
create table if not exists us_movie_day (
  movie_id text not null,
  kind text not null check (kind in ('boxoffice', 'advance')),
  report_date date not null,
  territory text not null default 'US' check (territory = 'US'),
  currency text not null default 'USD' check (currency = 'USD'),
  source text not null default 'BFILMY_USA',
  source_movie_ids bigint[] not null,
  source_url text not null,
  source_etag text,
  source_seen_at timestamptz,            -- when this ETag was first seen by Fyre
  source_updated_at timestamptz,         -- not supplied by the source: always null
  source_timezone text not null default 'US theater-local',
  synced_at timestamptz not null default now(),
  release_day integer,                   -- DERIVED (Day 0 = premieres, Day 1 = first full US date)
  final boolean not null default false,
  gross numeric(14, 2) not null default 0,
  tickets integer not null default 0,
  seats integer not null default 0,
  shows integer not null default 0,      -- imported show rows
  shows_source integer,                  -- source summary count (can differ)
  zero_seat_shows integer not null default 0,
  occupancy numeric(7, 3),               -- DERIVED tickets / seats (zero-seat shows excluded)
  occupancy_source numeric(7, 3),        -- SOURCE figure (not weighted); null when ids are merged
  theatres integer,
  cities integer,
  states integer,
  source_summary jsonb not null default '[]'::jsonb,
  recon jsonb not null default '{}'::jsonb,
  metric_origin jsonb not null default '{}'::jsonb,
  breakdown_pruned boolean not null default false,
  detail_pruned boolean not null default false,
  primary key (movie_id, kind, report_date)
);
create index if not exists us_movie_day_date_idx on us_movie_day (kind, report_date);

-- Breakdown tuples per movie/date/dimension:
--   [[key...], shows, seats, sold, gross, zero_seat_shows, theatres, cities]
-- keys: state [state] | city [city, state] | theater [theater, city, state, chain]
--       chain [chain] | format [format] | language [language] | format_language [format, language]
create table if not exists us_movie_breakdown (
  movie_id text not null,
  kind text not null check (kind in ('boxoffice', 'advance')),
  report_date date not null,
  dimension text not null check (dimension in ('state', 'city', 'theater', 'chain', 'format', 'language', 'format_language')),
  rows jsonb not null,
  row_count integer not null default 0,
  primary key (movie_id, kind, report_date, dimension)
);
create index if not exists us_movie_breakdown_date_idx on us_movie_breakdown (report_date, dimension);

-- Raw show rows, source values as published (not whitespace-normalized).
create table if not exists us_show (
  kind text not null check (kind in ('boxoffice', 'advance')),
  report_date date not null,
  show_id bigint not null,
  movie_id text not null,
  source_movie_id bigint not null,
  show_local text not null,              -- as published, e.g. 2026-09-30+18:35 (theater-local)
  show_date_local date,
  show_time_local text,
  format text,
  language text,
  theater text,
  city text,
  state text,
  chain text,
  sold integer not null default 0,
  seats integer not null default 0,
  price numeric(10, 2),
  gross numeric(12, 2) not null default 0,
  occupancy_source numeric(7, 3),
  synced_at timestamptz not null default now(),
  primary key (kind, report_date, show_id)
);
create index if not exists us_show_movie_idx on us_show (movie_id, kind, report_date);

-- Fyre's own daily capture of each open advance date (the first sync on
-- each US Eastern date), so advance DoD can be DERIVED:
--   DoD = capture(show_date, captured_on) - capture(show_date, captured_on - 1)
create table if not exists us_advance_snapshot (
  movie_id text not null,
  show_date date not null,
  captured_on date not null,
  captured_at timestamptz not null default now(),
  source_etag text,
  gross numeric(14, 2) not null default 0,
  tickets integer not null default 0,
  seats integer not null default 0,
  shows integer not null default 0,
  theatres integer,
  cities integer,
  states integer,
  dims jsonb not null default '{}'::jsonb,
  primary key (movie_id, show_date, captured_on)
);

-- Per source file: ETag and when it was first seen / last synced.
create table if not exists us_sync_file (
  kind text not null check (kind in ('boxoffice', 'advance')),
  report_date date not null,
  url text not null,
  etag text,
  first_seen_at timestamptz,             -- when Fyre first saw this ETag
  last_checked_at timestamptz,           -- last time the sync asked the source (incl. 304 Not Modified)
  synced_at timestamptz not null default now(), -- last time the file was processed
  status text not null,
  movies_total integer,
  movies_imported integer,
  rows_total integer,
  rows_imported integer,
  error text,
  primary key (kind, report_date)
);
alter table us_sync_file add column if not exists last_checked_at timestamptz;

alter table us_movie_map enable row level security;
alter table us_movie_day enable row level security;
alter table us_movie_breakdown enable row level security;
alter table us_show enable row level security;
alter table us_advance_snapshot enable row level security;
alter table us_sync_file enable row level security;
-- Public read only for tables that hold tracked movies' numbers.
drop policy if exists "us_movie_day public read" on us_movie_day;
create policy "us_movie_day public read" on us_movie_day for select using (true);
drop policy if exists "us_movie_breakdown public read" on us_movie_breakdown;
create policy "us_movie_breakdown public read" on us_movie_breakdown for select using (true);
drop policy if exists "us_show public read" on us_show;
create policy "us_show public read" on us_show for select using (true);
drop policy if exists "us_advance_snapshot public read" on us_advance_snapshot;
create policy "us_advance_snapshot public read" on us_advance_snapshot for select using (true);

-- Retention. Dry run by default; returns what was (or would be) removed.
create or replace function us_prune(
  p_breakdown_days int default 90,
  p_detail_days int default 30,
  p_show_days int default 7,
  p_snapshot_days int default 30,
  p_dry_run boolean default true
) returns jsonb
language plpgsql as $$
declare
  us_today date := (now() at time zone 'America/New_York')::date;
  b_cut date := us_today - p_breakdown_days;
  d_cut date := us_today - p_detail_days;
  s_cut date := us_today - p_show_days;
  n_dims int; n_detail int; n_shows int; n_snaps int;
begin
  select count(*) into n_dims from us_movie_breakdown
    where report_date < b_cut and dimension in ('state', 'chain', 'format', 'language', 'format_language');
  select count(*) into n_detail from us_movie_breakdown
    where report_date < d_cut and dimension in ('city', 'theater');
  select count(*) into n_shows from us_show
    where (kind = 'boxoffice' and report_date < s_cut) or (kind = 'advance' and report_date < us_today);
  select count(*) into n_snaps from us_advance_snapshot where captured_on < us_today - p_snapshot_days;
  if not p_dry_run then
    delete from us_movie_breakdown where report_date < b_cut and dimension in ('state', 'chain', 'format', 'language', 'format_language');
    update us_movie_day set breakdown_pruned = true where report_date < b_cut and not breakdown_pruned;
    delete from us_movie_breakdown where report_date < d_cut and dimension in ('city', 'theater');
    update us_movie_day set detail_pruned = true where report_date < d_cut and not detail_pruned;
    delete from us_show where (kind = 'boxoffice' and report_date < s_cut) or (kind = 'advance' and report_date < us_today);
    delete from us_advance_snapshot where captured_on < us_today - p_snapshot_days;
  end if;
  return jsonb_build_object('dry_run', p_dry_run, 'us_today', us_today, 'breakdown_rows', n_dims,
    'city_theater_rows', n_detail, 'show_rows', n_shows, 'snapshots', n_snaps);
end;
$$;
revoke execute on function us_prune(int, int, int, int, boolean) from public, anon, authenticated;
