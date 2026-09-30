import { NextRequest, NextResponse } from 'next/server';
import { loadMovieAnalytics } from '@/lib/analytics/load';
import { loadUsaAnalytics } from '@/lib/analytics/usa';
import { parseTerritory } from '@/lib/analytics/query';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// One movie's release days, advance snapshots and lifetime totals (Fyre
// Analytics -- the same numbers the movie page, comparison and poster use).
// ?territory=us -> USA · Indian-language screenings (USD).
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const m = parseTerritory(req.nextUrl.searchParams.get('territory')) === 'US' ? await loadUsaAnalytics(params.slug) : await loadMovieAnalytics(params.slug);
    if (!m) return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    return NextResponse.json(m, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load this movie' }, { status: 502 });
  }
}
