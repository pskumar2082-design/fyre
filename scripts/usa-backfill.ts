// USA history import (BFILMY USA feed -> us_* tables), tracked movies only.
//
//   npx tsx --env-file=.env.local scripts/usa-backfill.ts <from> <to> [--no-advance]
//   npx tsx --env-file=.env.local scripts/usa-backfill.ts --release-days
//   npx tsx --env-file=.env.local scripts/usa-backfill.ts --retention [--dry-run]
//
// Dates are USA report dates (YYYY-MM-DD). Files are fetched one at a time
// with a pause in between. Safe to re-run: every write is an upsert.
import { supabaseAdmin } from '../lib/supabaseAdmin';
import { dateRange } from '../lib/bfilmy/sync';
import { loadTrackedMovies, refreshReleaseDays, runUsRetention, syncUsFile } from '../lib/usa/sync';
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
  const kinds: UsKind[] = args.includes('--no-advance') ? ['boxoffice'] : ['boxoffice', 'advance'];
  const movies = await loadTrackedMovies();
  for (const date of dates) {
    for (const kind of kinds) {
      const t0 = Date.now();
      const r = await syncUsFile(kind, date, { force: true, includeEnded: true, movies, skipReleaseDays: true });
      console.log(`${date} ${kind} ${r.status} movies=${r.movies ?? '-'} imported=${r.imported ?? '-'} rows=${r.rowsImported ?? '-'}/${r.rows ?? '-'} shows=${r.showsStored ?? 0} snaps=${r.snapshots ?? 0}${r.mismatches?.length ? ` mismatch=${r.mismatches.join(',')}` : ''}${r.error ? ` ERROR ${r.error}` : ''} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      if (r.status === 'error') process.exitCode = 1;
      await sleep(500);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
