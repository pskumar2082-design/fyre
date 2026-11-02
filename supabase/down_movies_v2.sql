-- Undo for migration_movies_v2.sql. NOT RUN; needs explicit approval.
-- Drops ONLY the tables that migration created. bf_*, us_*, mmi_* untouched.
drop table if exists sk_fetch_log;
drop table if exists mv_status_log;
drop table if exists mv_reported_figure;
drop table if exists mv_figure_revision;
drop table if exists mv_figure_total;
drop table if exists mv_figure_day;
drop table if exists mv_source_link;
drop table if exists mv_movie;
