import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { syncBoxOffice } from '@/lib/syncBoxOffice';
import { discoverMovies } from '@/lib/discoverMovies';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// The admin panel's "Sync now" button calls this instead of
// /api/sync-boxoffice, so no cron secret ever has to live in browser code.
// It authorizes the request by checking the caller's own Supabase Auth
// session (the same login that guards the rest of /admin) rather than a
// shared secret.
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
  const movieId: string | undefined = body?.movie_id || undefined;

  // Only look for brand-new movies when re-syncing everything, not when
  // the admin asked to refresh one specific movie.
  const discovery = movieId ? { added: [] as string[], errors: [] as { title: string; message: string }[] } : await discoverMovies();

  const result = await syncBoxOffice(movieId);
  return NextResponse.json({ ...result, discovered: discovery.added, discoveryErrors: discovery.errors });
}
