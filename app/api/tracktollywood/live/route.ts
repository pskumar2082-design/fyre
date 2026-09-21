import { NextResponse } from 'next/server';
import { getLiveMovies } from '@/lib/tracktollywood/scraper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Public, unauthenticated -- read-only, cached (see lib/tracktollywood/cache.ts),
// nothing here writes to TrackTollywood or touches this app's own database.
export async function GET() {
  try {
    const movies = await getLiveMovies();
    return NextResponse.json({ movies, count: movies.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'failed to fetch TrackTollywood listing' }, { status: 502 });
  }
}
