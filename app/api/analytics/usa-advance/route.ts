import { NextRequest, NextResponse } from 'next/server';
import { loadUsaAdvanceTrend } from '@/lib/analytics/usa';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ?slug=the-paradise&date=2026-10-02 -- Fyre's daily captures of one USA
// advance show date with the DERIVED day-over-day change (DoD). Only from
// the day Fyre began capturing; never before.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  try {
    const list = await loadUsaAdvanceTrend(q.get('slug') ?? '', q.get('date') ?? '');
    if (!list) return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    return NextResponse.json({ date: q.get('date'), captures: list }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load' }, { status: 502 });
  }
}
