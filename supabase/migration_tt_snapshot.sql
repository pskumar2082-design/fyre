-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query).
--
-- TrackTollywood data is scraped live on every page load -- nothing about
-- a given day is ever persisted, so there's no way to show a real
-- "vs yesterday" comparison or a trend chart over time. This table fixes
-- that: a daily cron (see app/api/tracktollywood/snapshot/route.ts,
-- wired up in vercel.json) saves one row per tracked movie per calendar
-- day (IST), starting from whenever this migration is run. Comparisons
-- and trend charts are real from that point on -- there is no
-- backdating past data that was never saved.
create table if not exists tt_daily_snapshot (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,   -- calendar day (Asia/Kolkata) this row represents
  slug text not null,            -- TrackTollywood movie slug
  title text not null,
  state text not null,           -- TTMovieState at the time of this snapshot
  day_label text,                -- e.g. "Day 4" (present once released)
  gross_cr numeric,              -- lifetime gross parsed to crores, for aggregation
  gross_label text,              -- as displayed, e.g. "₹5.41 Cr"
  today_cr numeric,              -- that day's own collection, parsed to crores
  fetched_at timestamptz not null default now(),
  unique (snapshot_date, slug)
);

create index if not exists tt_daily_snapshot_date_idx on tt_daily_snapshot (snapshot_date);
create index if not exists tt_daily_snapshot_slug_idx on tt_daily_snapshot (slug);

-- No RLS policy is added on purpose: this table is only ever written by
-- the cron route (via the service-role client, which bypasses RLS) and
-- only ever read from server components using that same service-role
-- client -- it's never queried from the browser, so there's no public
-- policy to define.
alter table tt_daily_snapshot enable row level security;
