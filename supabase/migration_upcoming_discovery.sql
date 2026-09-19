-- Same idea as migration_discovery.sql, but for the `upcoming` table: lets
-- lib/discoverUpcoming.ts recognize movies it's already added from
-- Sacnilk's public "Upcoming Movies" listing.
--
-- Safe to run more than once.

alter table upcoming add column if not exists sacnilk_slug text;
create unique index if not exists upcoming_sacnilk_slug_key on upcoming (sacnilk_slug) where sacnilk_slug is not null;
