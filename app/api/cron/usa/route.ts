import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { acquireUsLock, defaultUsTargets, loadTrackedMovies, processUsBackfills, releaseUsLock, runUsRetention, syncUsFile, type UsFileResult } from '@/lib/usa/sync';
import { usSourceLog } from '@/lib/usa/fetch';
import { usToday } from '@/lib/usa/days';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// USA sync ("USA · Indian-language screenings"). Called after the India
// sync by .github/workflows/bfilmy-sync.yml. Does nothing unless
// USA_SYNC_ENABLED=1 (scheduled USA ingestion is switched on separately,
// after the storage check). CRON_SECRET as for /api/cron/bfilmy.
//
// Each run: today's (and, until final, yesterday's) box office, advance
// for today + 3 days (unchanged files skipped by ETag), then history for
// USA ids the admin matched, then retention once a US day when
// BF_RETENTION_ENABLED=1.
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  const token = req.nextUrl.searchParams.get('token');
  const secret = process.env.CRON_SECRET;
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (process.env.USA_SYNC_ENABLED !== '1') return NextResponse.json({ skipped: 'USA_SYNC_ENABLED is not 1' });

  // Never two USA syncs at once.
  const lock = await acquireUsLock(120_000);
  if (!lock) return NextResponse.json({ skipped: 'another USA sync is running' });
  const logStart = usSourceLog.length;
  const deadline = Date.now() + 50_000;
  const errors: string[] = [];
  const files: UsFileResult[] = [];
  try {
    const movies = await loadTrackedMovies();
    for (const t of defaultUsTargets()) {
      if (Date.now() > deadline) break;
      const r = await syncUsFile(t.kind, t.date, { movies });
      files.push(r);
      if (r.status === 'error') errors.push(`${t.kind} ${t.date}: ${r.error}`);
    }
  } catch (err: any) {
    errors.push(`sync: ${err?.message ?? err}`);
  }

  let backfills: unknown = null;
  if (Date.now() < deadline) {
    try {
      backfills = await processUsBackfills(deadline);
    } catch (err: any) {
      errors.push(`backfill: ${err?.message ?? err}`);
    }
  }

  let retention: unknown = null;
  if (process.env.BF_RETENTION_ENABLED === '1' && Date.now() < deadline) {
    try {
      const db = supabaseAdmin as any;
      const { data } = await db.from('bf_sync_state').select('value').eq('key', 'last_us_retention').maybeSingle();
      const today = usToday();
      if ((data?.value as any)?.day !== today) {
        retention = await runUsRetention(false);
        await db.from('bf_sync_state').upsert({ key: 'last_us_retention', value: { day: today, result: retention }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      } else retention = { skipped: 'already ran today' };
    } catch (err: any) {
      errors.push(`retention: ${err?.message ?? err}`);
    }
  }

  await releaseUsLock(lock);
  const sourceRequests = usSourceLog.slice(logStart);
  const failed = files.length > 0 && files.every((f) => f.status === 'error');
  // A failed sync changes nothing: the site keeps serving the last good data.
  return NextResponse.json({ sourceRequests, files, backfills, retention, errors }, { status: failed ? 502 : 200 });
}
