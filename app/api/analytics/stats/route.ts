import { NextRequest, NextResponse } from 'next/server';
import { loadMovieStats } from '@/lib/analytics/stats';
import { parseTerritory } from '@/lib/analytics/compare';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ?slug=the-paradise[&territory=us] -> MovieStats (lib/analytics/statsModel.ts)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  try {
    const stats = await loadMovieStats(q.get('slug') ?? '', parseTerritory(q.get('territory')));
    if (!stats) return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    return NextResponse.json(stats, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load these stats' }, { status: 502 });
  }
}
