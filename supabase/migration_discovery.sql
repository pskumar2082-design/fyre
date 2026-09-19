-- Adds support for automatically discovering new movies from Sacnilk's
-- public "India Box Office Collection" listing page, instead of requiring
-- them to be entered by hand in admin first.
--
-- `sacnilk_slug` is the movie's slug from that listing (e.g.
-- "Happy_Journey_2026", from https://www.sacnilk.com/movie/Happy_Journey_2026)
-- -- a stable id we use to recognize "we already added this one" across
-- runs, and to derive its day-wise article URL for the existing
-- /api/sync-boxoffice sync (source_url) without needing a second lookup.
--
-- Safe to run more than once.

alter table now_showing add column if not exists sacnilk_slug text;
create unique index if not exists now_showing_sacnilk_slug_key on now_showing (sacnilk_slug) where sacnilk_slug is not null;
