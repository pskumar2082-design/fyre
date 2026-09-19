-- Adds "Advance booking" data support alongside the existing "Tracked"
-- (post-release) data — the same Advance/Tracked toggle you see on
-- box-office tracker sites. A movie can have both: advance = pre-release
-- booking numbers, tracked = actual collections once it's running.
--
-- Run this AFTER migration_breakdown.sql (it adds columns to the same two
-- tables that migration creates). Safe to run more than once.

-- Advance-side lifetime stats on now_showing, mirroring the existing
-- lifetime_gross / lifetime_tickets / lifetime_shows / cities / lifetime_occupancy
-- columns which are the "tracked" side.
alter table now_showing add column if not exists advance_gross text;
alter table now_showing add column if not exists advance_tickets text;
alter table now_showing add column if not exists advance_shows text;
alter table now_showing add column if not exists advance_cities integer;
alter table now_showing add column if not exists advance_occupancy numeric;

-- 'advance' or 'tracked'. Existing breakdown rows (entered before this
-- column existed) default to 'tracked' since that's what they were.
alter table box_office_breakdown add column if not exists kind text not null default 'tracked';
