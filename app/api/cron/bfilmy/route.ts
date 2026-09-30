import { NextRequest, NextResponse } from 'next/server';
import { dateRange, defaultTargets, syncBfilmy, type SyncTarget } from '@/lib/bfilmy/sync';
import { syncDetail } from '@/lib/bfilmy/detailSync';
import { fetchAliases } from '@/lib/bfilmy/fetch';
import { buildAliasMap } from '@/lib/bfilmy/normalize';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { trackedKeys } from '@/lib/tracking';
import { syncMovieMintCatalog } from '@/lib/moviemint/sync';
import { processBackfills } from '@/lib/moviemint/backfill';
import { runRetention } from '@/lib/retention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// The sync job. Called every 30 minutes by .github/workflows/bfilmy-sync.yml
// and once a day by Vercel Cron. CRON_SECRET via `Authorization: Bearer`
// (or `?token=` for a manual run).
//
// Each run:
//   1. MovieMint catalog (at most every 6 hours, or ?catalog=1): which
//      movies Fyre tracks (lib/moviemint/sync.ts)
//   2. BFILMY summary files for today/yesterday + advance dates -- tracked
//      movies only; every other title in the files is skipped
//   3. BFILMY show-level files for the same dates (tracked movies only)
//   4. history import for newly tracked movies, in whatever time is left
//   5. retention (once a day, only when BF_RETENTION_ENABLED=1)
//
// ?from=YYYY-MM-DD&to=YYYY-MM-DD re-syncs past box-office days instead
// (max 10); scripts/bfilmy-backfill.ts has no time limit.
export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization');
  const token = req.nextUrl.searchParams.get('token');
  const secret = process.env.CRON_SECRET;
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const deadline = started + 50_000;
  const q = req.nextUrl.searchParams;
  const errors: string[] = [];

  // 1. MovieMint catalog
  let catalog: unknown = null;
  try {
    const { data } = await supabaseAdmin.from('bf_sync_state').select('value').eq('key', 'last_moviemint_sync').maybeSingle();
    const last = Date.parse((data?.value as any)?.fetchedAt ?? '') || 0;
    if (q.get('catalog') === '1' || Date.now() - last > 6 * 3600_000) catalog = await syncMovieMintCatalog();
  } catch (err: any) {
    errors.push(`moviemint: ${err?.message ?? err}`);
  }

  // Which BFILMY titles to import.
  let tracked: Awaited<ReturnType<typeof trackedKeys>> | null = null;
  try {
    tracked = await trackedKeys(supabaseAdmin as any);
    if (tracked.keys.size === 0) throw new Error('no tracked movies yet (run the MovieMint catalog sync)');
  } catch (err: any) {
    errors.push(`tracked movies: ${err?.message ?? err}`);
  }
  if (!tracked || tracked.keys.size === 0) {
    return NextResponse.json({ catalog, errors }, { status: 502 });
  }

  let targets: SyncTarget[] = defaultTargets();
  const from = q.get('from');
  const to = q.get('to') ?? from;
  if (from && to) {
    const dates = dateRange(from, to);
    if (dates.length === 0 || dates.length > 10) return NextResponse.json({ error: 'from/to must be valid dates, at most 10 days apart' }, { status: 400 });
    targets = dates.map((date) => ({ kind: 'boxoffice' as const, date }));
  }

  // 2. summary
  const result = await syncBfilmy(targets, { tracked: tracked.keys });
  errors.push(...result.errors);

  // 3. show-level detail
  let detail: Awaited<ReturnType<typeof syncDetail>> = [];
  if (q.get('detail') !== '0') {
    try {
      const aliasMap = buildAliasMap(await fetchAliases());
      const ordered = [...targets.filter((t) => t.kind === 'boxoffice'), ...targets.filter((t) => t.kind === 'advance')];
      detail = await syncDetail(ordered, aliasMap, { deadline, tracked: tracked.keys, scopeSlugs: tracked.slugs });
      for (const f of detail) if (f.status === 'error') errors.push(`detail ${f.kind} ${f.date}: ${f.error}`);
      await supabaseAdmin
        .from('bf_sync_state')
        .upsert({ key: 'last_detail_sync', value: { finishedAt: new Date().toISOString(), files: detail }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    } catch (err: any) {
      errors.push(`detail: ${err?.message ?? String(err)}`);
    }
  }

  // 4. history for newly tracked movies
  let backfills: Awaited<ReturnType<typeof processBackfills>> = [];
  if (Date.now() < deadline) {
    try {
      backfills = await processBackfills(deadline);
    } catch (err: any) {
      errors.push(`backfill: ${err?.message ?? err}`);
    }
  }

  // 5. retention
  let retention: unknown = null;
  if (process.env.BF_RETENTION_ENABLED === '1' && Date.now() < deadline) {
    try {
      retention = await runRetention({ deadline, daily: true });
    } catch (err: any) {
      errors.push(`retention: ${err?.message ?? err}`);
    }
  }

  const failed = result.files.length > 0 && result.files.every((f) => f.status === 'error');
  return NextResponse.json({ ...result, errors, catalog, detail, backfills, retention }, { status: failed ? 502 : 200 });
}
