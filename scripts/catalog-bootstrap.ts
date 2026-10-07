// One-time 90-day catalog bootstrap, run locally (no time limit). Reads
// only the last 90 days of BFILMY India + USA date files, each ONCE, oldest
// first, and discovers/imports everything in them. Resumable; safe to
// re-run. Never creates more than CATALOG_BOOTSTRAP_MAX (default 400) new
// movies: at the cap it stops safely and reports.
//
//   npx tsx --env-file=.env.local scripts/catalog-bootstrap.ts --start --dates 3 --cap 20
//       small controlled run: the 3 oldest dates of the window, at most 20 new movies
//   npx tsx --env-file=.env.local scripts/catalog-bootstrap.ts [--dates N] [--cap N] [minutes]
//       continue from where it stopped
//   npx tsx --env-file=.env.local scripts/catalog-bootstrap.ts --resume
//       continue after a cap pause (after raising CATALOG_BOOTSTRAP_MAX)
//   npx tsx --env-file=.env.local scripts/catalog-bootstrap.ts --auto
//       let the scheduled cron continue it from now on
//   npx tsx --env-file=.env.local scripts/catalog-bootstrap.ts --status
//       state + statistics, no source requests
import { bootstrapStats, runCatalogBootstrap } from '../lib/catalog/bootstrap';
import { getBootstrap } from '../lib/catalog/bootstrapState';

function num(args: string[], flag: string): number | undefined {
  const i = args.indexOf(flag);
  return i >= 0 && /^\d+$/.test(args[i + 1] ?? '') ? Number(args[i + 1]) : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--status')) {
    const s = await getBootstrap();
    if (!s) return console.log('No bootstrap started.');
    const { createdSlugs, createdUsa, usaImport, joined, ...state } = s;
    console.log(JSON.stringify({ ...state, created: { india: createdSlugs.length, usa: createdUsa.length }, stats: await bootstrapStats(s) }, null, 1));
    return;
  }
  const flagged = new Set([num(args, '--dates'), num(args, '--cap')].map(String));
  const minutes = Number(args.find((a) => /^\d+$/.test(a) && !flagged.has(a))) || 60;
  const r = await runCatalogBootstrap(Date.now() + minutes * 60_000, {
    start: args.includes('--start'),
    resume: args.includes('--resume'),
    auto: args.includes('--auto'),
    maxDates: num(args, '--dates'),
    maxCreate: num(args, '--cap')
  });
  if (!r) console.log('No bootstrap running. Start one with --start.');
  else console.log(JSON.stringify({ ...r, dates: r.dates.length ? `${r.dates.length} dates: ${r.dates[0]} .. ${r.dates[r.dates.length - 1]}` : 'none' }, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
