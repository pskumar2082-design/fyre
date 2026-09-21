import { NextRequest, NextResponse } from 'next/server';
import { snapshotToday } from '@/lib/tracktollywood/snapshot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// This is the endpoint Vercel Cron calls once a day (see vercel.json) to
// save today's TrackTollywood numbers into tt_daily_snapshot -- the data
// the home dashboard's "Earning Summary" trend chart reads back. Same
// CRON_SECRET pattern as the existing /api/sync-boxoffice route: Vercel
// adds it automatically as `Authorization: Bearer <CRON_SECRET>` on
// cron-triggered requests, and a `?token=` query param works the same
// way for a manual trigger/test.
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  const token = req.nextUrl.searchParams.get('token');
  const authorized =
    !!process.env.CRON_SECRET && (bearer === `Bearer ${process.env.CRON_SECRET}` || token === process.env.CRON_SECRET);
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await snapshotToday();
  return NextResponse.json(result);
}
