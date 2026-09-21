// ---------------------------------------------------------------------------
// Runs syncMovieMint()'s discovery pass from YOUR OWN MACHINE instead of
// Vercel's serverless function.
//
// Why this exists: MovieMint's Cloudflare protection challenges Vercel's
// outbound IP specifically. Two separate "Sync MovieMint now" clicks from
// the admin panel both came back "blocked: interactive challenge detected"
// on /tracked, while the exact same page loaded cleanly, same day, over an
// ordinary residential connection. This script runs the identical,
// already-reviewed sync code in lib/syncMovieMint.ts -- same matching
// logic, same DB writes, same source-of-truth -- just from this machine's
// network instead, sidestepping the IP-reputation issue entirely. No
// CAPTCHA-solving, no interactive-challenge workaround: if THIS machine
// ever gets challenged too, the sync reports `blocked` and stops, exactly
// like it does on Vercel.
//
// One-time setup:
//   npm install            -- picks up the `puppeteer` and `tsx` devDeps
//                              this script needs (see package.json)
//
// Usage (from the project root):
//   npm run sync:moviemint:local              -- full discovery run
//   npm run sync:moviemint:local -- <slug>    -- refresh one movie only
//
// Reads .env.local directly (same file `next dev` already uses) so this
// needs no separate configuration and no dotenv dependency.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) {
    console.error('.env.local not found in the current directory -- run this from the project root (fyre-nextjs/).');
    process.exit(1);
  }
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  if (process.env.VERCEL) {
    // Should never happen when run via `npm run` on a developer machine --
    // just a guard against accidentally invoking this ON Vercel, where the
    // admin panel's own "Sync MovieMint now" button already does the same
    // job (and where launchBrowser() would ignore this script anyway).
    console.error('VERCEL is set -- this script is meant to run on your own machine, not on Vercel.');
    process.exit(1);
  }

  // Dynamic imports AFTER loadEnvLocal() -- lib/supabaseAdmin.ts reads
  // process.env at module-load time, so importing anything that pulls it
  // in before the env is loaded would capture empty values and fail with
  // a confusing Supabase error instead of a clear one.
  const { syncMovieMint } = await import('../lib/syncMovieMint');

  const slug = process.argv[2];
  console.log(slug ? `Syncing one movie: ${slug}` : 'Running full MovieMint discovery from this machine...');
  console.log('(A Chromium window may briefly appear in the background -- headless, nothing to interact with.)\n');

  const summary = await syncMovieMint(slug);
  console.log(JSON.stringify(summary, null, 2));

  if (summary.errors.length > 0) {
    console.log(`\n${summary.errors.length} error(s) -- see above. If any say "blocked: interactive challenge", this machine's network got flagged too; otherwise this is a good sign it's specifically a Vercel-IP issue.`);
  }
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
