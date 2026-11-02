-- Fyre v2: new movie data model (Sacnilk as the preferred future source). Nov 2026.
--
-- NOT RUN. Hand-run in the Supabase SQL Editor only after explicit approval.
-- ADDITIVE ONLY: creates new mv_* / sk_* tables. No existing table is
-- touched; the BFILMY (bf_*, us_*) and MovieMint (mmi_*) data stay as they
-- are until the separate legacy clean-up is approved. Safe to re-run.
-- Undo: supabase/down_movies_v2.sql.
--
-- Nothing writes to these tables yet: the Sacnilk importer is not built
-- until the permission details are reviewed, and it will not run without a
-- separate approval.
--
-- Design rules enforced here:
--   * one row per (movie, source, day, metric): figures from different
--     sources live in separate rows and are never stored as a combined total
--   * every figure carries its status: early_estimate | estimate | reported
--   * worldwide is stored only when the source states it
--   * lifecycle changes only a status column; nothing is deleted

create table if not exists mv_movie (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  primary_language text not null,
  languages text[] not null default '{}',
  release_date date,
  poster_url text,
  certificate text,
  lifecycle text not null default 'upcoming' check (lifecycle in ('upcoming', 'now_showing', 'ending_check', 'run_ended', 'archived')),
  lifecycle_since timestamptz not null default now(),
  show_on_fyre boolean not null default false,  -- admin selection for non-Telugu movies
  featured boolean not null default false,
  status_override text check (status_override in ('running', 'ended')),
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mv_movie_lifecycle_idx on mv_movie (lifecycle, release_date desc);

-- Which source record is which Fyre movie. Set only after an admin confirms
-- the match; never merged automatically.
create table if not exists mv_source_link (
  source text not null check (source in ('sacnilk')),
  source_key text not null,                   -- e.g. Sacnilk's page slug
  movie_id uuid not null references mv_movie (id),
  source_url text,
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (source, source_key)
);

create table if not exists mv_figure_day (
  movie_id uuid not null references mv_movie (id),
  source text not null check (source in ('sacnilk')),
  day date not null,
  day_number int,
  metric text not null check (metric in ('india_net', 'india_gross', 'overseas_gross', 'worldwide_gross', 'occupancy_pct', 'shows')),
  value numeric not null,
  figure_status text not null check (figure_status in ('early_estimate', 'estimate')),
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  primary key (movie_id, source, day, metric)
);

-- Totals exactly as the source states them (Fyre never sums across sources).
create table if not exists mv_figure_total (
  movie_id uuid not null references mv_movie (id),
  source text not null check (source in ('sacnilk')),
  metric text not null check (metric in ('india_net', 'india_gross', 'overseas_gross', 'worldwide_gross')),
  value numeric not null,
  figure_status text not null check (figure_status in ('early_estimate', 'estimate')),
  as_of date,
  source_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  primary key (movie_id, source, metric)
);

-- Sacnilk revises estimates; every change is kept.
create table if not exists mv_figure_revision (
  id bigserial primary key,
  movie_id uuid not null references mv_movie (id),
  source text not null,
  day date,                                    -- null for a total
  metric text not null,
  old_value numeric,
  new_value numeric,
  old_status text,
  new_status text,
  changed_at timestamptz not null default now()
);

-- "Reported": a producer's or studio's announced figure, typed in by an
-- admin with a link. Shown apart from estimates, never combined.
create table if not exists mv_reported_figure (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references mv_movie (id),
  metric text not null check (metric in ('india_net', 'india_gross', 'overseas_gross', 'worldwide_gross')),
  value numeric not null,
  reported_by text not null,
  source_url text not null check (source_url ~ '^https?://'),
  reported_on date not null,
  entered_by text,
  created_at timestamptz not null default now()
);

create table if not exists mv_status_log (
  id bigserial primary key,
  movie_id uuid not null references mv_movie (id),
  change jsonb not null,                       -- e.g. {"lifecycle":["now_showing","ending_check"]} or admin flags
  reason text not null,
  changed_by text not null,                    -- admin email or 'lifecycle-check'
  changed_at timestamptz not null default now()
);

-- Every Sacnilk request the importer makes (once approved).
create table if not exists sk_fetch_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  url text not null,
  http_status int,
  ms int,
  ok boolean,
  blocked boolean not null default false,      -- 403 / 429 / challenge: the importer stops
  note text
);

alter table mv_movie enable row level security;
alter table mv_source_link enable row level security;
alter table mv_figure_day enable row level security;
alter table mv_figure_total enable row level security;
alter table mv_figure_revision enable row level security;
alter table mv_reported_figure enable row level security;
alter table mv_status_log enable row level security;
alter table sk_fetch_log enable row level security;
drop policy if exists "mv_movie public read" on mv_movie;
create policy "mv_movie public read" on mv_movie for select using (true);
drop policy if exists "mv_figure_day public read" on mv_figure_day;
create policy "mv_figure_day public read" on mv_figure_day for select using (true);
drop policy if exists "mv_figure_total public read" on mv_figure_total;
create policy "mv_figure_total public read" on mv_figure_total for select using (true);
drop policy if exists "mv_reported_figure public read" on mv_reported_figure;
create policy "mv_reported_figure public read" on mv_reported_figure for select using (true);
-- mv_source_link, mv_figure_revision, mv_status_log, sk_fetch_log: admin / service role only.
