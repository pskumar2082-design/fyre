import { NextRequest, NextResponse } from 'next/server';
import { dateRange, defaultTargets, istDate, syncBfilmy, type SyncTarget } from '@/lib/bfilmy/sync';
import { syncDetail } from '@/lib/bfilmy/detailSync';
import { fetchAliases } from '@/lib/bfilmy/fetch';
import { fyreAliasMap } from '@/lib/catalog/aliases';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { trackedKeys } from '@/lib/tracking';
import { syncMovieMintCatalog } from '@/lib/moviemint/sync';
import { processBackfills } from '@/lib/moviemint/backfill';
import { runCatalogBootstrap } from '@/lib/catalog/bootstrap';
import { pruneCandidates } from '@/lib/catalog/candidates';
import { runRetention } from '@/lib/retention';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// The sync job. Called every 30 minutes by .github/workflows/bfilmy-sync.yml
// and once a day by Vercel Cron. CRON_SECRET via `Authorization: Bearer`
// (or `?token=` for a manual run).
//
// BFILMY is the discovery source; Fyre owns the catalog (lib/catalog).
// MovieMint is optional enrichment and never decides what is tracked.
//
// Each run:
//   1. BFILMY summary files for today/yesterday + advance dates: one fetch
//      and one parse per file. Every title in a file is recorded as a
//      listing (identity only) and attached to its Fyre movie, auto-created
//      when that is certain, or left for admin review; then the figures of
//      every catalog movie in the file are imported from that same file
//   2. BFILMY show-level files for the same dates (catalog movies only)
//   3. the one-time 90-day catalog bootstrap while it is running (started
//      with ?bootstrap=start or scripts/catalog-bootstrap.ts), else
//      history import for newly added movies, batched by date file, never
//      older than 90 days
//   4. retention (once a day, only when BF_RETENTION_ENABLED=1), and once a
//      day temporary discovery candidates inactive for 30 days are pruned
//   5. MovieMint list refresh (enrichment only, at most daily, or
//      ?catalog=1) -- a failure here has no effect on steps 1-4
//
// ?from=YYYY-MM-DD&to=YYYY-MM-DD re-syncs past box-office days instead
// (max 10, no discovery); scripts/bfilmy-backfill.ts has no time limit.
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

  // Which BFILMY titles to import: the catalog's. An empty catalog is not
  // an error -- discovery below can create the first movies.
  let tracked: Awaited<ReturnType<typeof trackedKeys>>;
  try {
    tracked = await trackedKeys(supabaseAdmin as any);
  } catch (err: any) {
    return NextResponse.json({ errors: [`catalog: ${err?.message ?? err}`] }, { status: 502 });
  }

  let targets: SyncTarget[] = defaultTargets();
  const from = q.get('from');
  const to = q.get('to') ?? from;
  if (from && to) {
    const dates = dateRange(from, to);
    if (dates.length === 0 || dates.length > 10) return NextResponse.json({ error: 'from/to must be valid dates, at most 10 days apart' }, { status: 400 });
    targets = dates.map((date) => ({ kind: 'boxoffice' as const, date }));
  }

  // 1. summary + discovery (regular runs only; a ?from= re-sync imports
  // catalog movies only). Movies discovered in this run are imported from
  // the same files and get their show-level data below.
  const result = await syncBfilmy(targets, { tracked: tracked.keys, listings: !from });
  errors.push(...result.errors);
  for (const slug of result.listings?.newSlugs ?? []) tracked.slugs.add(slug);

  // 2. show-level detail
  let detail: Awaited<ReturnType<typeof syncDetail>> = [];
  if (q.get('detail') !== '0') {
    try {
      const aliasMap = await fyreAliasMap(await fetchAliases());
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

  // 3. 90-day catalog bootstrap (only while one is running) ...
  let bootstrap: unknown = null;
  if (!from && Date.now() < deadline) {
    try {
      bootstrap = await runCatalogBootstrap(deadline, { start: q.get('bootstrap') === 'start', fromCron: true });
    } catch (err: any) {
      errors.push(`bootstrap: ${err?.message ?? err}`);
    }
  }

  // ... then history for newly added movies (batched by date file; waits
  // while the bootstrap runs)
  let backfills: Awaited<ReturnType<typeof processBackfills>> = [];
  if (Date.now() < deadline) {
    try {
      backfills = await processBackfills(deadline);
    } catch (err: any) {
      errors.push(`backfill: ${err?.message ?? err}`);
    }
  }

  // 4. retention
  let retention: unknown = null;
  if (process.env.BF_RETENTION_ENABLED === '1' && Date.now() < deadline) {
    try {
      retention = await runRetention({ deadline, daily: true });
    } catch (err: any) {
      errors.push(`retention: ${err?.message ?? err}`);
    }
  }

  // 4b. Temporary discovery candidates with no BFILMY activity for 30 days
  //     (lib/catalog/candidates.ts) -- once a day.
  let candidates: unknown = null;
  if (process.env.CATALOG_CANDIDATE_RETENTION !== '0' && Date.now() < deadline) {
    try {
      const today = istDate(0);
      const { data } = await supabaseAdmin.from('bf_sync_state').select('value').eq('key', 'last_candidate_prune').maybeSingle();
      if ((data?.value as any)?.day !== today) {
        candidates = await pruneCandidates(today);
        await supabaseAdmin.from('bf_sync_state').upsert({ key: 'last_candidate_prune', value: { day: today, result: candidates }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      }
    } catch (err: any) {
      errors.push(`candidates: ${err?.message ?? err}`);
    }
  }

  // 5. MovieMint list -- enrichment only, failure-tolerant, never a gate.
  let catalog: unknown = null;
  if (process.env.MOVIEMINT_ENRICH !== '0' && deadline - Date.now() > 5_000) {
    try {
      const { data } = await supabaseAdmin.from('bf_sync_state').select('value').eq('key', 'last_moviemint_sync').maybeSingle();
      const last = Date.parse((data?.value as any)?.fetchedAt ?? '') || 0;
      if (q.get('catalog') === '1' || Date.now() - last > 24 * 3600_000) catalog = await syncMovieMintCatalog({ timeoutMs: Math.min(15_000, deadline + 5_000 - Date.now()) });
    } catch (err: any) {
      catalog = { skipped: `MovieMint unavailable: ${String(err?.message ?? err).slice(0, 200)}` };
    }
  }

  const failed = result.files.length > 0 && result.files.every((f) => f.status === 'error');
  return NextResponse.json({ ...result, errors, catalog, detail, bootstrap, backfills, retention, candidates }, { status: failed ? 502 : 200 });
}
