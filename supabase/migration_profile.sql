-- Adds support for automatically pulling each movie's full Sacnilk profile
-- page (https://www.sacnilk.com/movie/<slug>) into fyre: synopsis, Key
-- Details, Release Information, the "Total Collections Summary" cards, and
-- -- for movies released in more than one language -- a Net Collection +
-- Verdict card per language version (see lib/sacnilkMovieProfileParser.ts).
--
-- Only reads sacnilk.com's own public movie profile pages, the same public
-- content migration_scraper.sql already reads from their day-wise articles.
-- Safe to run more than once.

alter table now_showing add column if not exists description text;
alter table now_showing add column if not exists runtime text;
alter table now_showing add column if not exists cbfc_rating text;
alter table now_showing add column if not exists profile_languages text;
alter table now_showing add column if not exists ott_release_status text;

alter table now_showing add column if not exists total_india_gross text;
alter table now_showing add column if not exists total_worldwide text;
alter table now_showing add column if not exists total_overseas text;
alter table now_showing add column if not exists total_india_net text;
alter table now_showing add column if not exists india_share_pct numeric;
alter table now_showing add column if not exists overseas_share_pct numeric;
alter table now_showing add column if not exists box_office_verdict text;

alter table now_showing add column if not exists profile_synced_at timestamptz;

-- One row per language version, for movies Sacnilk tracks separately by
-- language -- e.g. a pan-India release with its own Hindi/Tamil/Telugu/
-- English "... Version - Daily Net Collection" section, each with its own
-- Net Collection total and Verdict (see https://www.sacnilk.com/movie/Resident_Evil_2026).
create table if not exists movie_versions (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references now_showing(id) on delete cascade,
  language text not null,
  net_collection text,
  verdict text,
  synced_at timestamptz default now(),
  unique (movie_id, language)
);

alter table movie_versions enable row level security;

drop policy if exists "Public read access" on movie_versions;
create policy "Public read access" on movie_versions for select using (true);

-- Deliberately no insert/update/delete policy for anon/authenticated here --
-- rows are written only by the sync routes using the Supabase service role
-- key, which bypasses RLS entirely, same as daily_collections.
