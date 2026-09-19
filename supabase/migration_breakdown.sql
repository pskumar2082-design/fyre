-- Adds full box-office tracking to Now Showing: richer per-movie fields
-- (release date, language, genre, lifetime stats) plus a new table for the
-- state/language/format-wise daily breakdown table on each movie's page.
--
-- Run this ONCE in the Supabase SQL Editor, after schema.sql (and seed.sql,
-- if you ran it) have already been run.

alter table now_showing add column if not exists release_date date;
alter table now_showing add column if not exists language text default '';
alter table now_showing add column if not exists genre text default '';
alter table now_showing add column if not exists lifetime_gross text default '';
alter table now_showing add column if not exists lifetime_tickets text default '';
alter table now_showing add column if not exists lifetime_shows text default '';
alter table now_showing add column if not exists cities integer;
alter table now_showing add column if not exists lifetime_occupancy numeric;

create table if not exists box_office_breakdown (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references now_showing(id) on delete cascade,
  breakdown_type text not null default 'state', -- 'state' | 'language' | 'format'
  label text not null,                          -- e.g. "Uttar Pradesh", "Hindi", "IMAX"
  day_date date not null,
  gross numeric default 0,                       -- in ₹ crore
  shows integer default 0,
  tickets_sold integer default 0,
  ff integer default 0,
  sold_out integer default 0,
  occ_pct numeric default 0,
  created_at timestamptz default now()
);

alter table box_office_breakdown enable row level security;

create policy "public read" on box_office_breakdown for select using (true);
create policy "auth write" on box_office_breakdown for all using (auth.role() = 'authenticated');
