-- Sacnilk is discontinued (2026-09) -- MovieMint is now the sole
-- box-office source, including discovering brand-new movies (see
-- createNowShowingFromMovieMint in lib/syncMovieMint.ts). A future-dated
-- movie it discovers also gets an `upcoming` row for the countdown
-- section, so `upcoming` needs the same moviemint_slug mapping
-- `now_showing` already got in migration_moviemint.sql -- otherwise a
-- re-sync can't recognize a row it already created and would insert a
-- duplicate every run.
--
-- Same pattern as migration_upcoming_discovery.sql's sacnilk_slug.
-- Safe to run more than once.

alter table upcoming add column if not exists moviemint_slug text;
create unique index if not exists upcoming_moviemint_slug_key on upcoming (moviemint_slug) where moviemint_slug is not null;
