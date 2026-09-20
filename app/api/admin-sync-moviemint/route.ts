import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncMovieMint } from '@/lib/syncMovieMint';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
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
