import { NextRequest, NextResponse } from 'next/server';
import { loadStatsBreakdown, parseStatsBreakdownRequest } from '@/lib/analytics/stats';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ?slug=&dimension=state|city|language|format|territory|city_format|chain|theater|format_language
//  &territory=us &kind=boxoffice|advance &from=&to= &window=tracked|later|all &date=(advance show date)
//  &state=&format= &sort=gross&dir=desc &offset=0&limit=10
// Aggregated on the server; one page of rows per response. `totals` is
// computed over every row before paging.
export async function GET(req: NextRequest) {
  const parsed = parseStatsBreakdownRequest(req.nextUrl.searchParams);
  if ('error' in parsed) return NextResponse.json(parsed, { status: 400 });
  try {
    const b = await loadStatsBreakdown(parsed);
    return NextResponse.json(b, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load this breakdown' }, { status: 502 });
  }
}
