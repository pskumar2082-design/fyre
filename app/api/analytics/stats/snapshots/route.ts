import { NextRequest, NextResponse } from 'next/server';
import { loadStatsSnapshots } from '@/lib/analytics/stats';
import { parseTerritory } from '@/lib/analytics/compare';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ?slug=&kind=boxoffice|advance&date=YYYY-MM-DD[&territory=us]
// Live-day refreshes (intraday) or an advance show date's build-up, exactly
// as captured -- never interpolated.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const slug = String(q.get('slug') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  try {
    const s = await loadStatsSnapshots(slug, parseTerritory(q.get('territory')), q.get('kind') === 'advance' ? 'advance' : 'boxoffice', q.get('date'));
    return NextResponse.json(s, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load these snapshots' }, { status: 502 });
  }
}
