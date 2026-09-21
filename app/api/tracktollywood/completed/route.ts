import { NextResponse } from 'next/server';
import { getCompletedMovies } from '@/lib/tracktollywood/scraper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const movies = await getCompletedMovies();
    return NextResponse.json({ movies, count: movies.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'failed to fetch TrackTollywood completed archive' }, { status: 502 });
  }
}
