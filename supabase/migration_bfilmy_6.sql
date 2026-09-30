-- Show list lookups (lib/analytics/shows.ts: one movie, one kind, one date,
-- ordered by id). Without this the planner could walk the whole bf_show
-- table by primary key and hit the statement timeout for dates with no
-- stored rows. Safe to run more than once.
create index if not exists bf_show_movie_id_idx on bf_show (slug, kind, date, id);
