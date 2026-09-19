import { NextRequest, NextResponse } from 'next/server';
import { syncBoxOffice } from '@/lib/syncBoxOffice';
import { discoverMovies } from '@/lib/discoverMovies';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Fetches every now_showing row that has a `source_url` set, reads that
// public article, and updates:
//   - daily_collections (full day-by-day history, upserted per day number)
//   - now_showing.lifetime_gross / lifetime_shows / lifetime_occupancy / amt
//     (best-effort — see lib/sacnilkParser.ts for exactly what's parsed)
//
// This is the endpoint Vercel Cron calls on a schedule (see vercel.json).
// It only accepts requests carrying CRON_SECRET, which Vercel adds
// automatically as `Authorization: Bearer <CRON_SECRET>` on cron-triggered
// requests. The admin panel's "Sync now" button uses a *different* route
// (/api/admin-sync-boxoffice) that checks your admin login instead, so this
// secret never has to live in browser code.
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  const token = req.nextUrl.searchParams.get('token');
  const authorized =
    !!process.env.CRON_SECRET && (bearer === `Bearer ${process.env.CRON_SECRET}` || token === process.env.CRON_SECRET);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const movieId = req.nextUrl.searchParams.get('movie_id') ?? undefined;

  // Only look for brand-new movies on a regular full run, not when this
  // was called to re-sync one specific movie.
  const discovery = movieId ? { added: [] as string[], errors: [] as { title: string; message: string }[] } : await discoverMovies();

  const result = await syncBoxOffice(movieId);
  return NextResponse.json({ ...result, discovered: discovery.added, discoveryErrors: discovery.errors });
}
