import { NextRequest, NextResponse } from 'next/server';
import { getMovieDay } from '@/lib/bfilmy/source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// One tracked day's breakdown tables for a movie -- what the movie page
// fetches when someone opens an older day (see lazyDays in
// lib/boxoffice/types.ts).
export async function GET(_req: NextRequest, { params }: { params: { slug: string; date: string } }) {
  try {
    const day = await getMovieDay(params.slug, params.date);
    if (!day) return NextResponse.json({ error: 'No tracked day found' }, { status: 404 });
    return NextResponse.json(day, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load this day right now' }, { status: 502 });
  }
}
