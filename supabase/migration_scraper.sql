-- Adds support for automatically pulling PUBLISHED box-office reporting
-- (e.g. a Sacnilk day-wise collection article) into fyre on a schedule, via
-- /api/sync-boxoffice. This only ever reads a public news article's
-- rendered text — day-wise Net/Gross/Shows/Occupancy — never anything
-- gated behind login, a subscription, or a booking flow like a seat map.
-- State/language/format breakdown stays manual (supabase/migration_breakdown.sql),
-- since that level of detail is paywalled on the sites we checked.
--
-- Safe to run more than once.

-- The article URL to sync a movie's day-wise numbers from, and when we
-- last successfully synced it.
alter table now_showing add column if not exists source_url text;
alter table now_showing add column if not exists source_synced_at timestamptz;

-- One row per released day, straight from the article's own day-wise table.
create table if not exists daily_collections (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references now_showing(id) on delete cascade,
  day_number integer not null,
  day_date date,
  day_label text,   -- e.g. "1st Friday"
  gross numeric,    -- ₹ Cr
  net numeric,      -- ₹ Cr
  shows integer,
  occ_pct numeric,
  source text default 'sacnilk',
  created_at timestamptz default now(),
  unique (movie_id, day_number)
);

alter table daily_collections enable row level security;

drop policy if exists "Public read access" on daily_collections;
create policy "Public read access" on daily_collections for select using (true);

-- Deliberately no insert/update/delete policy for anon/authenticated here.
-- Rows are written only by /api/sync-boxoffice using the Supabase service
-- role key, which bypasses RLS entirely — nothing in the browser, including
-- a signed-in admin, can write to this table.
