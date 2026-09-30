import { NextRequest, NextResponse } from 'next/server';
import { getComparison, parseCompareParams } from '@/lib/analytics/compare';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ?movies=a,b&basis=day|cumulative|lifetime|advance&day=1&dimension=state&metric=gross&limit=10
// The Movie Comparison page and the comparison poster both read this exact
// view model (lib/analytics/compare.ts).
export async function GET(req: NextRequest) {
  const parsed = parseCompareParams(req.nextUrl.searchParams);
  if ('error' in parsed) return NextResponse.json(parsed, { status: 400 });
  try {
    const cmp = await getComparison(parsed);
    return NextResponse.json(cmp, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not build this comparison' }, { status: 502 });
  }
}
