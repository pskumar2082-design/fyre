import { NextRequest, NextResponse } from 'next/server';
import { loadMovieAnalytics } from '@/lib/analytics/load';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// One movie's release days, advance snapshots and lifetime totals (Fyre
// Analytics -- the same numbers the movie page, comparison and poster use).
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const m = await loadMovieAnalytics(params.slug);
    if (!m) return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    return NextResponse.json(m, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load this movie' }, { status: 502 });
  }
}
