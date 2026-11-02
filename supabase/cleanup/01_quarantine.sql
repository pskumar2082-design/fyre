-- Fyre legacy clean-up, step 1 of 2: QUARANTINE. NOT RUN.
-- Run only after: (a) the verified backup exists, (b) the legacy sync jobs
-- are switched off, (c) the site no longer reads these tables, and (d) you
-- approve this exact file.
--
-- Moves the 34 legacy tables and 19 legacy functions out of the public
-- schema into a new schema, legacy_archive. Nothing is deleted: the data
-- stays byte for byte, the API can no longer reach it, and
-- 01_quarantine_undo.sql moves everything back in one statement.
-- All or nothing: any error rolls the whole step back.
begin;
create schema if not exists legacy_archive;
revoke all on schema legacy_archive from anon, authenticated;

do $$
declare
  t text;
  f record;
  tables text[] := array[
    'bf_detail_file','bf_listing','bf_movie','bf_movie_breakdown','bf_movie_day',
    'bf_movie_day_detail','bf_show','bf_sync_state','bf_title_key','bf_venue',
    'us_advance_snapshot','us_movie_breakdown','us_movie_day','us_movie_map','us_show','us_sync_file',
    'mmi_catalog','mmi_fetch','mmi_movie','mmi_movie_day','mmi_snapshot','mm_movie','moviemint_match_review',
    'fyre_tracked_movie','fyre_movie_alias',
    'tt_daily_snapshot','source_snapshots','box_office_breakdown','multiplex_breakdown',
    'live_box_office','daily_collections','movie_versions','now_showing','upcoming'];
  funcs text[] := array[
    'bf_db_size','bf_dim_sum','bf_movie_cumulative','bf_movie_days','bf_prune_advance',
    'bf_prune_breakdowns','bf_prune_shows','bf_refresh_movies','bf_summary_dim_sum',
    'bf_upsert_venues','bf_venue_rollup','mmi_city_format_sum','mmi_movie_cumulative',
    'mmi_movie_days','mmi_prune_breakdowns','mmi_prune_snapshots','mmi_snapshot_series',
    'mmi_summary_dim_sum','us_prune'];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I set schema legacy_archive', t);
      raise notice 'moved table %', t;
    else
      raise notice 'not found (skipped) table %', t;
    end if;
  end loop;
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (funcs)
  loop
    execute format('alter function %s set schema legacy_archive', f.sig);
    raise notice 'moved function %', f.sig;
  end loop;
end $$;

-- Check before commit: nothing in scope may be left in public.
select 'left in public' as check, count(*) as n
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname = any (array['bf_movie','bf_movie_day','us_movie_day','mmi_movie','now_showing','upcoming']);
commit;
