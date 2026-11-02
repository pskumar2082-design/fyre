-- Fyre legacy clean-up, step 2 of 2: PERMANENT DELETE. NOT RUN.
-- Run only after a separate, explicit approval, at least 7 days after
-- 01_quarantine.sql, with the verified backup files in hand. After this the
-- only way back is restoring from that backup (tested in backup_verify.sh).
--
-- Deletes the legacy_archive schema and everything in it (the 34 tables and
-- 19 functions moved there by 01_quarantine.sql). Touches nothing else.
begin;
select count(*) as tables_to_drop
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'legacy_archive' and c.relkind = 'r';
drop schema legacy_archive cascade;
commit;
