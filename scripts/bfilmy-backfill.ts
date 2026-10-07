// One-off history import from BFILMY into Supabase.
//
//   npx tsx --env-file=.env.local scripts/bfilmy-backfill.ts 2026-01-01 2026-09-28 [--no-advance] [--reset]
//
// --reset first empties every bf_* table (for a clean rebuild after a
// change to how films are grouped); run it only on the first chunk.
//
//   npx tsx --env-file=.env.local scripts/bfilmy-backfill.ts --detail <from> <to> [--no-advance] [--keep-shows N]
//
// imports BFILMY's show-level files (box office + advance) for the range
// into the permanent aggregate tables (lib/bfilmy/detailSync.ts). Run it
// after the summary backfill for the same range. Raw show rows are only
// stored for final dates within the last N days (default 7).
//
//   npx tsx --env-file=.env.local scripts/bfilmy-backfill.ts --refresh-all [offset] [count]
//
// re-runs bf_refresh_movies for every film (after a change to that SQL
// function) without re-importing anything; offset/count let it run in
// chunks.
//
// Imports box office for every date in the range, plus advance bookings
// for the last 14 days of it (skip those with --no-advance, e.g. when
// importing older months in chunks), then fills posters and prunes old advance
// detail once at the end. Safe to re-run: every write is an upsert.
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
// .env.local -- nothing is printed except progress.
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { dateRange, syncBfilmy, type SyncTarget } from '../lib/bfilmy/sync';
import { syncDetail } from '../lib/bfilmy/detailSync';
import { fetchAliases } from '../lib/bfilmy/fetch';
import { fyreAliasMap } from '../lib/catalog/aliases';
import { trackedKeys } from '../lib/tracking';
import { ACTIVE_WINDOW_DAYS, windowStart } from '../lib/catalog/core';
import { istDate } from '../lib/bfilmy/sync';

// 90-day rule: BFILMY history older than the active window is not imported
// just because it exists. --allow-old overrides (deliberate one-off fixes).
function checkWindow(from: string, args: string[]) {
  const floor = windowStart(istDate(0));
  if (from && from < floor && !args.includes('--allow-old')) {
    console.error(`${from} is older than the ${ACTIVE_WINDOW_DAYS}-day window (from ${floor}). Add --allow-old only for a deliberate one-off fix.`);
    process.exit(1);
  }
}

// Only movies in Fyre's catalog are ever imported; every other title in
// BFILMY's files is skipped.
async function tracked() {
  const t = await trackedKeys(supabaseAdmin as any);
  if (t.keys.size === 0) throw new Error('No catalog movies yet: run scripts/catalog-bootstrap.ts --start first.');
  return t;
}

async function detailRange(from: string, to: string, withAdvance: boolean, keepShowDays: number) {
  const dates = dateRange(from, to);
  if (dates.length === 0) throw new Error('invalid date range');
  const aliasMap = await fyreAliasMap(await fetchAliases());
  const t = await tracked();
  let failed = 0;
  for (const date of dates) {
    const t0 = Date.now();
    const targets: SyncTarget[] = [{ kind: 'boxoffice', date }, ...(withAdvance ? [{ kind: 'advance' as const, date }] : [])];
    // Advance totals come from the summary file too; make sure both exist.
    if (withAdvance) await syncBfilmy([{ kind: 'advance', date }], { posters: false, prune: false, recordState: false, tracked: t.keys });
    const r = await syncDetail(targets, aliasMap, { keepShowDays, tracked: t.keys, scopeSlugs: t.slugs });
    failed += r.filter((f) => f.status === 'error').length;
    console.log(
      `${date} ${r.map((f) => `${f.kind[0]}=${f.status}${f.movies ? `(${f.movies} films, ${f.shows} shows${f.reconcileIssues ? `, ${f.reconcileIssues} reconcile issues` : ''}${f.showsStored ? `, ${f.showsStored} show rows` : ''})` : ''}${f.error ? ` ${f.error}` : ''}`).join(' ')} ${((Date.now() - t0) / 1000).toFixed(1)}s`
    );
  }
  if (failed) process.exitCode = 1;
}

async function resetTables() {
  // bf_movie_day is large (~100k rows): delete it a half-month at a time so
  // each statement stays inside Supabase's API statement timeout.
  const start = new Date('2024-12-01T00:00:00Z');
  const end = new Date(Date.now() + 60 * 86_400_000);
  for (let t = start; t < end; ) {
    const next = new Date(t.getTime() + 15 * 86_400_000);
    const from = t.toISOString().slice(0, 10);
    const to = next.toISOString().slice(0, 10);
    const { error } = await supabaseAdmin.from('bf_movie_day').delete().gte('date', from).lt('date', to);
    if (error) throw new Error(`reset bf_movie_day ${from}..${to}: ${error.message}`);
    t = next;
  }
  const { error: leftover } = await supabaseAdmin.from('bf_movie_day').delete().neq('slug', '');
  if (leftover) throw new Error(`reset bf_movie_day: ${leftover.message}`);
  for (const [table, col] of [
    ['bf_movie', 'slug'],
    ['bf_title_key', 'key'],
    ['bf_sync_state', 'key']
  ] as const) {
    const { error } = await supabaseAdmin.from(table).delete().neq(col, '');
    if (error) throw new Error(`reset ${table}: ${error.message}`);
  }
  console.log('reset: all bf_* tables emptied');
}

async function refreshAll(offset: number, count: number) {
  const slugs: string[] = [];
  for (let from = offset; from < offset + count; from += 1000) {
    const to = Math.min(from + 999, offset + count - 1);
    const { data, error } = await supabaseAdmin.from('bf_movie').select('slug').order('slug').range(from, to);
    if (error) throw new Error(`bf_movie list: ${error.message}`);
    slugs.push(...(data ?? []).map((r) => r.slug));
    if (!data || data.length < to - from + 1) break;
  }
  for (let i = 0; i < slugs.length; i += 10) {
    const { error } = await supabaseAdmin.rpc('bf_refresh_movies', { p_slugs: slugs.slice(i, i + 10) });
    if (error) throw new Error(`bf_refresh_movies: ${error.message}`);
  }
  console.log(`refreshed ${slugs.length} films (offset ${offset})`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--detail') {
    const [from, to] = args.slice(1).filter((a) => !a.startsWith('--') && /^\d{4}-\d{2}-\d{2}$/.test(a));
    checkWindow(from, args);
    const k = args.indexOf('--keep-shows');
    await detailRange(from, to ?? from, !args.includes('--no-advance'), k >= 0 ? Number(args[k + 1]) : 7);
    return;
  }
  if (args[0] === '--refresh-all') {
    await refreshAll(Number(args[1] ?? 0), Number(args[2] ?? 100000));
    return;
  }
  const [from, to] = args.filter((a) => !a.startsWith('--'));
  checkWindow(from, args);
  const withAdvance = !args.includes('--no-advance');
  if (args.includes('--reset')) await resetTables();
  if (!from || !to) {
    console.error('usage: tsx --env-file=.env.local scripts/bfilmy-backfill.ts <from YYYY-MM-DD> <to YYYY-MM-DD>');
    process.exit(1);
  }
  const dates = dateRange(from, to);
  if (dates.length === 0) throw new Error('invalid date range');
  const advanceDates = new Set(withAdvance ? dates.slice(-14) : []);

  let ok = 0;
  let missing = 0;
  const errors: string[] = [];
  for (let i = 0; i < dates.length; i += 5) {
    const slice = dates.slice(i, i + 5);
    const targets: SyncTarget[] = slice.flatMap((date) => [
      { kind: 'boxoffice' as const, date },
      ...(advanceDates.has(date) ? [{ kind: 'advance' as const, date }] : [])
    ]);
    const r = await syncBfilmy(targets, { posters: false, prune: false, recordState: false, tracked: (await tracked()).keys });
    for (const f of r.files) {
      if (f.status === 'ok') ok++;
      else if (f.status === 'missing') missing++;
    }
    errors.push(...r.errors);
    console.log(`${slice[0]}..${slice[slice.length - 1]}: ${r.files.map((f) => `${f.kind[0]}${f.date.slice(5)}=${f.status}${f.movies ? `(${f.movies})` : ''}`).join(' ')}`);
  }

  const final = await syncBfilmy([], { posters: true, prune: true, tracked: (await tracked()).keys });
  console.log(`done: ${ok} files imported, ${missing} not published, posters set ${final.postersSet}, advance rows pruned ${final.advancePruned}`);
  if (errors.length || final.errors.length) {
    console.log('errors:', [...errors, ...final.errors].slice(0, 20));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
