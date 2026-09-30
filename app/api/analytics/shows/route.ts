import { NextRequest, NextResponse } from 'next/server';
import { loadShows } from '@/lib/analytics/shows';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ?slug=the-paradise&date=2026-09-24[&kind=advance]
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  try {
    const list = await loadShows(q.get('slug') ?? '', q.get('date') ?? '', q.get('kind') === 'advance' ? 'advance' : 'boxoffice');
    // Highest-grossing shows first; at most `limit` rows go to the browser.
    const limit = Math.min(2000, Math.max(1, Number(q.get('limit')) || 500));
    return NextResponse.json({ ...list, total: list.rows.length, rows: list.rows.slice(0, limit) }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load shows' }, { status: 502 });
  }
}
