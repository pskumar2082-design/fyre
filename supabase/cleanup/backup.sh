#!/usr/bin/env bash
# Fyre legacy clean-up: full backup BEFORE anything is quarantined or deleted.
# Run on your Mac. Read-only against Supabase: it only reads and downloads.
#
# Needs, in this shell only (never saved to a file or committed):
#   SUPABASE_DB_URL     Supabase -> Connect -> Session pooler URI, with your
#                       database password filled in
#   SUPABASE_URL        https://<project>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY   for downloading the storage files
# Tools: pg_dump and psql matching the server's major version
#   (brew install postgresql@17, or whatever `select version()` reports), curl, jq.
set -euo pipefail
: "${SUPABASE_DB_URL:?set SUPABASE_DB_URL}"
: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"

STAMP=$(date -u +%Y%m%dT%H%MZ)
OUT="$HOME/fyre-backups/$STAMP"
mkdir -p "$OUT/storage"
cd "$OUT"

echo "1/5 Server version"
psql "$SUPABASE_DB_URL" -At -c "select version()" | tee server_version.txt

echo "2/5 Exact row counts of every public table"
psql "$SUPABASE_DB_URL" -At -F $'\t' -c "
  select table_name,
         (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by 1" > row_counts.tsv
wc -l row_counts.tsv

echo "3/5 Full dump of the public schema (structure + data, custom format)"
pg_dump "$SUPABASE_DB_URL" --schema=public --format=custom --no-owner --no-privileges --file=fyre_public.dump
echo "    plus a plain-SQL copy of the structure only"
pg_dump "$SUPABASE_DB_URL" --schema=public --schema-only --no-owner --no-privileges --file=fyre_public_schema.sql

echo "4/5 Storage bucket 'images'"
for prefix in news now_showing reviews upcoming; do
  curl -sf -X POST "$SUPABASE_URL/storage/v1/object/list/images" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' -d "{\"prefix\":\"$prefix/\",\"limit\":1000}" \
  | jq -r '.[] | select(.id != null) | .name' | while read -r name; do
      mkdir -p "storage/$prefix"
      curl -sf "$SUPABASE_URL/storage/v1/object/images/$prefix/$name" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
        -o "storage/$prefix/$name"
    done
done
find storage -type f | wc -l

echo "5/5 Checksums"
find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 shasum -a 256 > SHA256SUMS
echo "Backup written to $OUT"
echo "Next: run backup_verify.sh $OUT, then copy the folder to a second place (e.g. Google Drive)."
