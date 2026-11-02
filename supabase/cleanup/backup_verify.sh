#!/usr/bin/env bash
# Proves the backup restores: loads fyre_public.dump into a throwaway local
# Postgres (Docker) and compares every table's row count with the counts
# taken from Supabase at backup time. Touches nothing in Supabase.
#   usage: ./backup_verify.sh ~/fyre-backups/<stamp>
# Needs Docker Desktop running.
set -euo pipefail
DIR="${1:?usage: backup_verify.sh <backup folder>}"
cd "$DIR"
shasum -a 256 -c SHA256SUMS --quiet && echo "checksums OK"

MAJOR=$(grep -oE 'PostgreSQL [0-9]+' server_version.txt | grep -oE '[0-9]+')
NAME=fyre-restore-check
docker rm -f $NAME >/dev/null 2>&1 || true
docker run -d --name $NAME -e POSTGRES_PASSWORD=check -p 55432:5432 "postgres:$MAJOR" >/dev/null
trap 'docker rm -f $NAME >/dev/null 2>&1 || true' EXIT
until docker exec $NAME pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
URL=postgresql://postgres:check@localhost:55432/postgres

# Stand-ins for Supabase's own roles and auth helpers, so policies restore.
# The dump recreates the public schema itself, so the empty one goes first
# (this is the throwaway container, never Supabase).
psql "$URL" -q -c "drop schema public cascade; create role anon; create role authenticated; create role service_role;
  create schema if not exists auth; create schema if not exists extensions;
  create function auth.uid() returns uuid language sql as 'select null::uuid';
  create function auth.role() returns text language sql as 'select null::text';
  create extension if not exists pgcrypto schema extensions;"
pg_restore --dbname="$URL" --no-owner --no-privileges --exit-on-error fyre_public.dump

psql "$URL" -At -F $'\t' -c "
  select table_name,
         (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by 1" > restored_counts.tsv

if diff -u row_counts.tsv restored_counts.tsv; then
  echo "VERIFIED: $(wc -l < row_counts.tsv) tables restored with identical row counts"
  date -u +%FT%TZ > VERIFIED
else
  echo "MISMATCH: do not continue with the clean-up"; exit 1
fi
