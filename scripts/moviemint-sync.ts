// MovieMint catalog + tracked-movie backfill, run locally (no time limit).
//
//   npx tsx --env-file=.env.local scripts/moviemint-sync.ts --catalog
//       refresh MovieMint's list and match new movies to BFILMY
//   npx tsx --env-file=.env.local scripts/moviemint-sync.ts --backfill [minutes]
//       import queued movies' history (resumable; default 30 minutes)
import { syncMovieMintCatalog } from '../lib/moviemint/sync';
import { processBackfills } from '../lib/moviemint/backfill';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--catalog')) {
    const r = await syncMovieMintCatalog();
    console.log(JSON.stringify(r, null, 1));
  }
  const b = args.indexOf('--backfill');
  if (b >= 0) {
    const minutes = Number(args[b + 1]) || 30;
    const r = await processBackfills(Date.now() + minutes * 60_000);
    for (const x of r) console.log(x.id, x.status, x.next ?? '');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
