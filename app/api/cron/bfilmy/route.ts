import { NextRequest, NextResponse } from 'next/server';
import { dateRange, defaultTargets, syncBfilmy, type SyncTarget } from '@/lib/bfilmy/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Runs the BFILMY sync (lib/bfilmy/sync.ts). Called every 30 minutes by
// .github/workflows/bfilmy-sync.yml and once a day by Vercel Cron
// (vercel.json). Same CRON_SECRET check as the other cron routes: Vercel
// sends it as `Authorization: Bearer <CRON_SECRET>`; `?token=` works for a
// manual run.
//
// Optional `?from=YYYY-MM-DD&to=YYYY-MM-DD` re-syncs a range of past
// box-office days instead (max 10 days per call, to stay inside the
// function time limit) -- for a full history import use
// scripts/bfilmy-backfill.ts, which has no time limit.
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  const token = req.nextUrl.searchParams.get('token');
  const secret = process.env.CRON_SECRET;
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to') ?? from;
  let targets: SyncTarget[] = defaultTargets();
  if (from && to) {
    const dates = dateRange(from, to);
    if (dates.length === 0 || dates.length > 10) {
      return NextResponse.json({ error: 'from/to must be valid dates, at most 10 days apart' }, { status: 400 });
    }
    targets = dates.map((date) => ({ kind: 'boxoffice' as const, date }));
  }

  const result = await syncBfilmy(targets);
  return NextResponse.json(result, { status: result.errors.length && result.files.every((f) => f.status === 'error') ? 502 : 200 });
}
