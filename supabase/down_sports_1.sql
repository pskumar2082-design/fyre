-- Undo for migration_sports_1.sql. NOT RUN; needs explicit approval.
-- Drops ONLY the tables that migration created. Nothing else is touched.
drop table if exists sp_scorecard;
drop table if exists sp_standing;
drop table if exists sp_match;
drop table if exists sp_competition;
drop table if exists sp_call_log;
drop table if exists sp_feed_status;
