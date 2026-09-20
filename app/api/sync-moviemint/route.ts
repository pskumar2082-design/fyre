import { NextRequest, NextResponse } from 'next/server';
import { syncMovieMint } from '@/lib/syncMovieMint';

export const dynamic = 'force-dynamic';
// 280s, not 60s: verified against Vercel's current docs (fetched
// 2026-09-20, docs last updated 2026-08-24) -- Hobby plan functions with
// fluid compute (the account default) now support up to 300s max
// duration, for free, not the 60s previously assumed here. Real MovieMint
// renders were observed taking up to ~25-30s each (see
// moviemintBrowserRenderer.ts), so the old 60s ceiling left almost no
// room for more than one render per invocation and caused a real
// production FUNCTION_INVOCATION_TIMEOUT. 280s keeps a 20s margin under
// Vercel's actual 300s hard cap. lib/syncMovieMint.ts's
// HARD_MAX_DURATION_MS must be kept equal to this value.
export const maxDuration = 280;
// Chromium/puppeteer-core (see lib/moviemintBrowserRenderer.ts) is a native
// binary and cannot run under the Edge runtime -- Node.js is required.
export const runtime = 'nodejs';

// Vercel Cron entry point for the MovieMint sync (mirrors
// app/api/sync-boxoffice/route.ts's CRON_SECRET pattern exactly -- see
// that file's comment for why a shared secret instead of admin auth).
//
// NOT yet wired into vercel.json -- see the implementation report for why
// (Vercel plan cron-frequency constraints need confirming before this
// runs on its own 15-30 minute schedule). Until then, this endpoint is
// ready for an external scheduler (e.g. a free-tier cron service hitting
// it with ?token=) or manual triggering.
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  const token = req.nextUrl.searchParams.get('token');
  const authorized =
    !!process.env.CRON_SECRET && (bearer === `Bearer ${process.env.CRON_SECRET}` || token === process.env.CRON_SECRET);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get('slug') ?? undefined;

  try {
    const summary = await syncMovieMint(slug);
    return NextResponse.json(summary);
  } catch (err: any) {
    // Never echo raw error objects/stack traces that might carry request
    // internals -- just the message, same as the Sacnilk routes.
    return NextResponse.json({ error: err?.message ?? 'sync failed' }, { status: 500 });
  }
}
