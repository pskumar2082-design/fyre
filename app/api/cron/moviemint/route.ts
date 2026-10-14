import { NextRequest, NextResponse } from 'next/server';
import { acquireMmiLock, mmiSourceLog, releaseMmiLock, runMovieMintIndia } from '@/lib/moviemint/india/sync';
import { moviemintIndiaSyncEnabled } from '@/lib/sourcePolicy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// MovieMint catalog + India import (lib/moviemint/india/sync.ts). Called by
// .github/workflows/bfilmy-sync.yml BEFORE the USA sync, so USA matching
// always sees the current MovieMint catalog. Does nothing unless
// MOVIEMINT_INDIA_SYNC=1. CRON_SECRET as for /api/cron/bfilmy.
//
// Each run fetches at most MOVIEMINT_PAGES_PER_RUN pages (default 18) with
// MOVIEMINT_DELAY_MS between them (default 1200 ms), stops at the first
// refusal (HTTP 403/429 or a challenge page), and never deletes data: if
// MovieMint is unavailable the site keeps the last successful catalog and
// figures. ?catalog=1 forces the /tracked list refresh.
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  const token = req.nextUrl.searchParams.get('token');
  const secret = process.env.CRON_SECRET;
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!moviemintIndiaSyncEnabled()) return NextResponse.json({ skipped: 'MOVIEMINT_INDIA_SYNC is not 1' });

  const lock = await acquireMmiLock(90_000);
  if (!lock) return NextResponse.json({ skipped: 'another MovieMint sync is running' });
  const logStart = mmiSourceLog.length;
  try {
    const result = await runMovieMintIndia({ deadline: Date.now() + 52_000, forceCatalog: req.nextUrl.searchParams.get('catalog') === '1' });
    const failed = result.stoppedBy === 'catalog' || (result.pages.length > 0 && result.pages.every((p) => !p.ok));
    return NextResponse.json({ ...result, sourceRequests: mmiSourceLog.slice(logStart) }, { status: failed ? 502 : 200 });
  } catch (err: any) {
    return NextResponse.json({ errors: [String(err?.message ?? err)] }, { status: 500 });
  } finally {
    await releaseMmiLock(lock);
  }
}
