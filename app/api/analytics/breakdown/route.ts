import { NextRequest, NextResponse } from 'next/server';
import { DIMENSION_LABELS, loadBreakdown, loadMovieAnalytics } from '@/lib/analytics/load';
import { parseSelection, parseTerritory } from '@/lib/analytics/compare';
import { loadUsaAnalytics, loadUsaBreakdown } from '@/lib/analytics/usa';
import type { Dimension } from '@/lib/analytics/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ?slug=the-paradise&basis=day|cumulative|lifetime|advance&day=1&dimension=state[&limit=10][&territory=us]
// The TOTAL row (totalRow) is always computed over every row, before the limit.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const slug = q.get('slug') ?? '';
  const dimension = q.get('dimension') as Dimension | null;
  if (!dimension || !(dimension in DIMENSION_LABELS)) return NextResponse.json({ error: 'Unknown dimension' }, { status: 400 });
  const selection = parseSelection(q);
  if ('error' in selection) return NextResponse.json(selection, { status: 400 });
  try {
    const us = parseTerritory(q.get('territory')) === 'US';
    const m = us ? await loadUsaAnalytics(slug) : await loadMovieAnalytics(slug);
    if (!m) return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    const b = us ? await loadUsaBreakdown(m, selection, dimension) : await loadBreakdown(m, selection, dimension);
    const limit = Number(q.get('limit'));
    const out = limit > 0 ? { ...b, rows: b.rows.slice(0, limit) } : b;
    return NextResponse.json(out, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load this breakdown' }, { status: 502 });
  }
}
