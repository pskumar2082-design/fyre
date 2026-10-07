// USA history import (BFILMY USA feed -> us_* tables), tracked movies only.
//
//   npx tsx --env-file=.env.local scripts/usa-backfill.ts <from> <to> [--no-advance]
//   npx tsx --env-file=.env.local scripts/usa-backfill.ts --release-days
//   npx tsx --env-file=.env.local scripts/usa-backfill.ts --retention [--dry-run]
//
// Dates are USA report dates (YYYY-MM-DD). Each date file is fetched ONCE
// and imported for every tracked Fyre movie in it (never per movie), one
// at a time with a pause in between. No movie is created (no discovery);
// listings seen are recorded and settled as by the scheduled sync. Takes
// the USA sync lock so it never overlaps a scheduled USA run, refreshes
// release-day numbers at the end. Dates older than the 90-day window need
// --allow-old. Safe to re-run: every write is an upsert.
//
//   recovery of a missed range:
//   npx tsx --env-file=.env.local scripts/usa-backfill.ts 2026-09-30 2026-10-06 --no-advance
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { dateRange } from '../lib/bfilmy/sync';
import { acquireUsLock, loadTrackedMovies, refreshReleaseDays, releaseUsLock, runUsRetention, syncUsFile } from '../lib/usa/sync';
import { windowStart } from '../lib/catalog/core';
import { usToday } from '../lib/usa/days';
import type { UsKind } from '../lib/usa/normalize';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--release-days') {
    const { data } = await (supabaseAdmin as any).from('us_movie_map').select('movie_id').eq('match_status', 'matched');
    const ids = [...new Set((data ?? []).map((r: any) => r.movie_id))] as string[];
    await refreshReleaseDays(ids);
    console.log(`release days refreshed for ${ids.length} movies`);
    return;
  }
  if (args[0] === '--retention') {
    console.log(JSON.stringify(await runUsRetention(args.includes('--dry-run'))));
    return;
  }
  const [from, to] = args;
  const dates = dateRange(from, to);
  if (!dates.length) throw new Error('usage: usa-backfill.ts <from> <to> [--no-advance]');
  if (from < windowStart(usToday()) && !args.includes('--allow-old')) throw new Error(`${from} is older than the 90-day window; add --allow-old only for a deliberate one-off fix`);
  const kinds: UsKind[] = args.includes('--no-advance') ? ['boxoffice'] : ['boxoffice', 'advance'];
  const lock = await acquireUsLock(30 * 60_000);
  if (!lock) throw new Error('a USA sync is running right now; try again in a few minutes');
  const movies = await loadTrackedMovies();
  const touched = new Set<string>();
  const fetched: string[] = [];
  try {
  for (const date of dates) {
    for (const kind of kinds) {
      const t0 = Date.now();
      const r = await syncUsFile(kind, date, { force: true, movies, skipReleaseDays: true });
      fetched.push(`${kind} ${date}: ${r.status}`);
      if (r.status === 'ok') {
        const { data } = await (supabaseAdmin as any).from('us_movie_day').select('movie_id').eq('kind', kind).eq('report_date', date);
        for (const x of data ?? []) touched.add(x.movie_id);
      }
      console.log(`${date} ${kind} ${r.status} movies=${r.movies ?? '-'} imported=${r.imported ?? '-'} rows=${r.rowsImported ?? '-'}/${r.rows ?? '-'} shows=${r.showsStored ?? 0} snaps=${r.snapshots ?? 0}${r.mismatches?.length ? ` mismatch=${r.mismatches.join(',')}` : ''}${r.error ? ` ERROR ${r.error}` : ''} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (r.status === 'error') process.exitCode = 1;
      await sleep(500);
    }
  }
  if (touched.size) await refreshReleaseDays([...touched], movies);
  console.log(`${fetched.length} source files fetched (one per date and kind); release days refreshed for ${touched.size} movies`);
  } finally {
    await releaseUsLock(lock);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
