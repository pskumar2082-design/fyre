-- Undo for 01_quarantine.sql: moves every table and function in
-- legacy_archive back to public, exactly as they were. NOT RUN.
-- Works at any time before 02_drop.sql has been run.
begin;
do $$
declare r record;
begin
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'legacy_archive' and c.relkind in ('r', 'p')
  loop
    execute format('alter table legacy_archive.%I set schema public', r.relname);
  end loop;
  for r in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'legacy_archive'
  loop
    execute format('alter function %s set schema public', r.sig);
  end loop;
end $$;
commit;
