// MovieMint India importer, run from a computer (no Vercel time limit).
//
//   npx tsx scripts/moviemint-india.ts dry-run [--max N] [--out report.json]
//       No database writes. Fetches MovieMint's /tracked list (and, unless
//       --no-fetch, each movie's day-series page, paced) and reports what
//       the MovieMint India policy would publish: links, new movies,
//       BFILMY-only movies it would hide, India coverage per movie.
//   npx tsx scripts/moviemint-india.ts run [--minutes M] [--pages-per-run N] [--only id,id] [--catalog]
//       The scheduled import, repeated until nothing is pending or time is
//       up (initial backfill). --only limits the pages to those MovieMint
//       ids (the catalog lists and links are always refreshed). Needs
//       supabase/migration_moviemint_india.sql and _2.sql.
//   npx tsx scripts/moviemint-india.ts status
//       The admin status counts (Supabase only).
// Reads .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
import { readFileSync, writeFileSync } from 'fs';

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}

const args = process.argv.slice(2);
const mode = args[0] ?? 'dry-run';
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string, d: string | null = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

async function main() {
  const sync = await import('../lib/moviemint/india/sync');
  if (mode === 'dry-run') {
    const max = opt('max');
    const report = await sync.dryRun({ fetchPages: !flag('no-fetch'), maxPages: max ? Number(max) : undefined, delayMs: Number(opt('delay', '1500')), log: (s) => console.log(s) });
    const out = opt('out', 'moviemint-india-dry-run.json')!;
    writeFileSync(out, JSON.stringify(report, null, 2));
    const by = (a: string) => report.plan.filter((p) => p.decision === a).length;
    console.log(`\nMovieMint list: ${report.onList} movies (fetched ${report.fetchedAt})`);
    console.log(`keep ${by('keep')} · link ${by('link')} · create ${by('create')} · review ${by('review')}`);
    console.log(`report written to ${out}`);
    return;
  }
  if (mode === 'run') {
    const until = Date.now() + Number(opt('minutes', '30')) * 60_000;
    const perRun = Number(opt('pages-per-run', '25'));
    for (let i = 1; Date.now() + 15_000 < until; i++) {
      const lock = await sync.acquireMmiLock(10 * 60_000);
      if (!lock) {
        console.log('another MovieMint sync holds the lock; waiting 60 s');
        await new Promise((r) => setTimeout(r, 60_000));
        continue;
      }
      try {
        const only = opt('only')?.split(',').map((x) => x.trim()).filter(Boolean);
        const r = await sync.runMovieMintIndia({ deadline: Math.min(until, Date.now() + 5 * 60_000), maxPages: perRun, forceCatalog: i === 1 && flag('catalog'), only });
        console.log(`run ${i}: ${r.pages.filter((p) => p.ok).length} ok, ${r.pages.filter((p) => !p.ok).length} failed, ${r.pending} pending, stopped by ${r.stoppedBy ?? 'nothing'}`);
        for (const e of r.errors.slice(0, 5)) console.log(`  ! ${e}`);
        if (r.stoppedBy === 'refused' || r.stoppedBy === 'catalog') break;
        // a first page reveals more work (its window dates), so stop only
        // once a run has nothing left to fetch
        if (r.pending === 0 && r.pages.length === 0) break;
      } finally {
        await sync.releaseMmiLock(lock);
      }
    }
    return;
  }
  if (mode === 'status') {
    const { sourceStatus } = await import('../lib/moviemint/india/status');
    const s = await sourceStatus();
    console.log(JSON.stringify({ policy: s.policy, tablesReady: s.tablesReady, counts: s.counts, missing: { ...s.missing, noIndiaData: s.missing.noIndiaData.length } }, null, 2));
    return;
  }
  console.error(`unknown mode ${mode}`);
  process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
