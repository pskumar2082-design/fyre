import { NextRequest, NextResponse } from 'next/server';
import { runCricketSync } from '@/lib/sports/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Scheduled cricket sync. Inactive until SPORTS_SYNC_ENABLED=1 and
// HIGHLIGHTLY_API_KEY are set (separate approval). CRON_SECRET via
// `Authorization: Bearer`, the same as the other cron routes.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await runCricketSync());
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
