import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
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

// The admin panel's MovieMint "Sync now" / "Refresh" controls call this
// (mirrors app/api/admin-sync-boxoffice/route.ts exactly -- same
// signed-in-admin-session auth, no shared secret in browser code).
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const slug: string | undefined = body?.slug || undefined;

  try {
    const summary = await syncMovieMint(slug);
    return NextResponse.json(summary);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'sync failed' }, { status: 500 });
  }
}
