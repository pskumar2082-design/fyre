-- Adds MovieMint (https://moviemintbo.com) as a second box-office data
-- source alongside Sacnilk, with proper per-source provenance so neither
-- source can silently overwrite the other's data.
--
-- Run this AFTER every earlier migration in this folder. Safe to run more
-- than once -- every statement is guarded.
--
-- What this adds:
--   1. now_showing.moviemint_slug          -- explicit external-id mapping,
--                                              same pattern as sacnilk_slug.
--   2. box_office_breakdown.source          -- 'sacnilk' | 'moviemint' |
--                                              'manual' | 'fyre_calculated',
--                                              plus a uniqueness fix so a
--                                              Sacnilk row and a MovieMint
--                                              row for the same movie/date/
--                                              breakdown can coexist instead
--                                              of colliding.
--   3. source_snapshots                     -- new table. Many rows per
--                                              movie per day (unlike
--                                              daily_collections, which is
--                                              one row per day_number) --
--                                              this is what lets FYRE later
--                                              show intra-day movement
--                                              ("+3,235 tickets, last 2h").
--   4. moviemint_match_review               -- movies MovieMint reports
--                                              that couldn't be confidently
--                                              matched to a now_showing row.
--   5. multiplex_breakdown                  -- MovieMint's "Daily Multiplex
--                                              Report" data: a named,
--                                              admittedly non-exhaustive set
--                                              of tracked multiplex chains.
--                                              Never treat this as full
--                                              theatre coverage.

-- ---------------------------------------------------------------------------
-- 1. moviemint_slug -- same idea as sacnilk_slug (migration_discovery.sql):
--    a stable id from MovieMint's own /movie/<slug> URL, so movies are
--    matched by an explicit mapping instead of by title text.
-- ---------------------------------------------------------------------------
alter table now_showing add column if not exists moviemint_slug text;
create unique index if not exists now_showing_moviemint_slug_key on now_showing (moviemint_slug) where moviemint_slug is not null;

-- ---------------------------------------------------------------------------
-- 2. box_office_breakdown provenance.
--
-- This table has always been admin-entered by hand (see app/admin/page.tsx),
-- never auto-synced -- so existing rows are backfilled as 'manual', not
-- 'sacnilk'. That's the accurate history, not a guess.
--
-- The table previously had no uniqueness constraint at all (rows were only
-- ever inserted one at a time from the admin form). Before letting an
-- automated sync upsert into it, add a real uniqueness constraint scoped by
-- source, so re-running a MovieMint (or Sacnilk, in future) sync updates
-- its own prior rows instead of appending duplicates, while never touching
-- another source's rows for the same movie/date/breakdown -- the two are
-- simply different rows now, distinguished by `source`.
-- ---------------------------------------------------------------------------
alter table box_office_breakdown add column if not exists source text not null default 'manual';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'box_office_breakdown_unique_row'
  ) then
    alter table box_office_breakdown
      add constraint box_office_breakdown_unique_row
      unique (movie_id, kind, breakdown_type, label, day_date, source);
  end if;
end $$;

-- MovieMint's breakdown rows additionally carry an "FF" figure whose exact
-- definition MovieMint doesn't document anywhere we found. Rather than
-- guess a meaning and mis-map it, it's stored as-is, clearly labeled as
-- raw/unresolved. Never rendered with an invented interpretation.
alter table box_office_breakdown add column if not exists raw_ff numeric;
comment on column box_office_breakdown.raw_ff is 'MovieMint-only. The "FF" figure from their breakdown table, meaning unconfirmed. Store and display as-is (or hide), never interpret.';

-- ---------------------------------------------------------------------------
-- 3. source_snapshots -- many rows per movie per day. This is the historical
--    time series daily_collections can't hold today (it's one row per
--    Sacnilk-style day_number, not per capture). Both advance and tracked
--    reads land here, one row per sync tick, per source.
--
--    NULL means "this source didn't report this metric" -- never 0.
-- ---------------------------------------------------------------------------
create table if not exists source_snapshots (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references now_showing(id) on delete cascade,
  source text not null,             -- 'sacnilk' | 'moviemint' | 'manual' | 'fyre_calculated'
  kind text not null,               -- 'advance' | 'tracked'
  market text not null default 'India',

  -- When the SOURCE says this snapshot is as of (e.g. MovieMint's "Day 45 --
  -- Sep 20, 2026" / "Completed shows till 20:43 IST"), parsed where
  -- possible. Distinct from fetched_at, which is when FYRE actually made
  -- the request -- the two can differ by minutes or more.
  source_captured_at timestamptz,
  fetched_at timestamptz not null default now(),

  gross numeric,
  tickets integer,
  shows integer,
  theatres integer,
  cities integer,
  capacity integer,
  occupancy numeric,

  -- The source's own freshness text verbatim, e.g. "Updated 1h 5m ago" or
  -- "Completed shows till 20:43 IST" -- kept alongside the parsed
  -- source_captured_at (when parsing that text into a timestamp succeeds)
  -- since the raw text is useful for debugging/display even when parsing
  -- doesn't fully succeed.
  source_updated_text text,

  -- Anything else captured but not (yet) promoted to its own column --
  -- forward-compatible without another migration.
  raw jsonb,

  created_at timestamptz default now()
);

-- Belt-and-suspenders: prevents a literal duplicate snapshot (same source,
-- kind, market, and source-reported timestamp) even if a sync run is
-- accidentally triggered twice back-to-back. The real "did anything change"
-- dedup (comparing metric values) happens in application code in
-- syncMovieMint.ts, since that logic needs to compare against the *previous*
-- row, not just reject exact duplicates.
create unique index if not exists source_snapshots_unique_capture
  on source_snapshots (movie_id, source, kind, market, source_captured_at)
  where source_captured_at is not null;

create index if not exists source_snapshots_lookup
  on source_snapshots (movie_id, source, kind, market, fetched_at desc);

alter table source_snapshots enable row level security;
drop policy if exists "Public read access" on source_snapshots;
create policy "Public read access" on source_snapshots for select using (true);
-- No insert/update/delete policy for anon/authenticated -- written only by
-- sync routes using the Supabase service role key, same convention as
-- daily_collections and movie_versions.

-- ---------------------------------------------------------------------------
-- 4. moviemint_match_review -- movies MovieMint reports that couldn't be
--    confidently matched to an existing now_showing row (ambiguous title
--    matches, or no match at all). Never auto-imported; logged for a human
--    to resolve.
-- ---------------------------------------------------------------------------
create table if not exists moviemint_match_review (
  id uuid primary key default gen_random_uuid(),
  moviemint_slug text not null,
  moviemint_title text not null,
  moviemint_release_date date,
  moviemint_language text,
  candidate_movie_ids uuid[] default '{}',   -- plausible now_showing.id matches, if any
  reason text not null,                       -- e.g. "no title match", "2 ambiguous candidates"
  status text not null default 'pending',     -- 'pending' | 'resolved' | 'ignored'
  created_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  resolved_at timestamptz,
  resolved_movie_id uuid references now_showing(id)
);

create unique index if not exists moviemint_match_review_slug_key on moviemint_match_review (moviemint_slug);

alter table moviemint_match_review enable row level security;
drop policy if exists "Public read access" on moviemint_match_review;
-- Deliberately NOT publicly readable -- this is an internal admin queue,
-- not content for the website. Only the service role (sync) and an
-- authenticated admin can read/write it.
create policy "Admin read" on moviemint_match_review for select using (auth.role() = 'authenticated');
create policy "Admin write" on moviemint_match_review for all using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 5. multiplex_breakdown -- MovieMint's "Daily Multiplex Report": chain ->
--    per-movie gross/shows for a given date, across a NAMED, LIMITED set of
--    multiplex chains MovieMint itself describes as "select multiplexes".
--    This is never a substitute for full theatre-wise coverage, and the
--    app layer must always label it accordingly (see components using
--    this table -- label as "Selected Multiplexes", never "All Theatres").
--
--    movie_id is nullable: a row starts life matched only by the raw title
--    MovieMint printed (e.g. "Resident Evil (E)"); it's linked to a real
--    now_showing row once/if that title resolves through the same matching
--    logic as everything else (see lib/syncMovieMint.ts), so a report that
--    mentions a movie FYRE doesn't track yet isn't dropped, just unlinked.
-- ---------------------------------------------------------------------------
create table if not exists multiplex_breakdown (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid references now_showing(id) on delete set null,
  raw_title text not null,          -- exactly as MovieMint printed it, e.g. "Resident Evil (E)"
  chain text not null,              -- e.g. "Prasads Multiplex"
  report_date date not null,
  gross numeric,
  shows integer,
  source text not null default 'moviemint',
  fetched_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create unique index if not exists multiplex_breakdown_unique_row
  on multiplex_breakdown (chain, report_date, raw_title, source);

create index if not exists multiplex_breakdown_movie_lookup on multiplex_breakdown (movie_id, report_date desc);

alter table multiplex_breakdown enable row level security;
drop policy if exists "Public read access" on multiplex_breakdown;
create policy "Public read access" on multiplex_breakdown for select using (true);
-- No public write policy -- service-role sync writes only, same as above.
