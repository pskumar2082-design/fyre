// History import for movies newly added to Fyre's catalog (resumable across
// cron runs). Batched: every pending movie is imported from the same date
// files -- one fetch and one parse per file, never one fetch per movie.
//   - core daily totals (summary files): from the movie's start date up to
//     the first day already stored
//   - breakdowns (show-level files): dates within the breakdown retention
//     window (default 90 days)
// 90-day rule (lib/catalog/core historyRange): history starts at the movie's
// known release date minus 3 days (Fyre catalog, else the legacy MovieMint
// record when one exists), but never before today - 89 days; unknown
// release = the window start. Older BFILMY history is never fetched. When
// the window cut a movie's run short, history_complete = false and the
// site labels its totals as a tracked period, not lifetime.
// While the 90-day catalog bootstrap (lib/catalog/bootstrap) is running it
// imports these movies from its own date files, so this waits.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAliases } from '@/lib/bfilmy/fetch';
import { fyreAliasMap } from '@/lib/catalog/aliases';
import { dateRange, istDate, syncBfilmy, type SyncTarget } from '@/lib/bfilmy/sync';
import { syncDetail } from '@/lib/bfilmy/detailSync';
import { BREAKDOWN_DAYS } from '@/lib/retention';
import { historyComplete, historyRange } from '@/lib/catalog/core';
import { bootstrapRunning } from '@/lib/catalog/bootstrapState';

type Cursor = {
  phase: 'summary' | 'detail' | 'done';
  next: string | null;
  from: string;
  // last summary date to import (the day before the first stored day)
  until?: string | null;
  slug: string;
  clamped?: boolean; // the 90-day window cut the start short
};

type Job = { id: string; slug: string; cur: Cursor; keys: Set<string>; error?: string };

export type BackfillResult = { id: string; status: string; next?: string | null };

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

async function getCursors(ids: string[]): Promise<Map<string, Cursor>> {
  const out = new Map<string, Cursor>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabaseAdmin
      .from('bf_sync_state')
      .select('key,value')
      .in('key', ids.slice(i, i + 100).map((id) => `backfill:${id}`));
    for (const r of (data ?? []) as any[]) out.set(String(r.key).slice('backfill:'.length), r.value as Cursor);
  }
  return out;
}

async function setCursor(id: string, c: Cursor | null) {
  if (!c) await supabaseAdmin.from('bf_sync_state').delete().eq('key', `backfill:${id}`);
  else await supabaseAdmin.from('bf_sync_state').upsert({ key: `backfill:${id}`, value: c, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

async function keysBySlug(slugs: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  for (let i = 0; i < slugs.length; i += 200) {
    const { data, error } = await supabaseAdmin.from('bf_title_key').select('key,slug').in('slug', slugs.slice(i, i + 200));
    if (error) throw new Error(`bf_title_key: ${error.message}`);
    for (const r of (data ?? []) as any[]) {
      const s = out.get(r.slug) ?? new Set<string>();
      s.add(r.key);
      out.set(r.slug, s);
    }
  }
  return out;
}

// Legacy MovieMint release dates, when that table is there. Never required.
async function moviemintReleaseDates(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const mm = ids.filter((id) => !id.startsWith('fyre-'));
  try {
    for (let i = 0; i < mm.length; i += 200) {
      const { data, error } = await supabaseAdmin.from('mm_movie').select('moviemint_id,release_date').in('moviemint_id', mm.slice(i, i + 200));
      if (error) return out;
      for (const r of (data ?? []) as any[]) if (r.release_date) out.set(r.moviemint_id, r.release_date);
    }
  } catch {
    /* enrichment only */
  }
  return out;
}

// Pure: the summary dates still to import for each job, grouped by date so
// each date file is fetched once for all of them.
export function summaryPlan(jobs: { id: string; next: string | null; until: string | null }[], today: string): Map<string, string[]> {
  const byDate = new Map<string, string[]>();
  for (const j of jobs) {
    if (!j.next) continue;
    const end = j.until && j.until < today ? j.until : today;
    for (const d of dateRange(j.next, end)) byDate.set(d, [...(byDate.get(d) ?? []), j.id]);
  }
  return new Map([...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

// Writes a movie's India history range once its import is finished.
export async function recordHistory(id: string, slug: string, range: { start: string; clamped: boolean }) {
  const { data: m } = await supabaseAdmin.from('bf_movie').select('first_date').eq('slug', slug).maybeSingle();
  const first = (m as any)?.first_date ?? null;
  // Before migration_catalog.sql the columns are missing: ignored.
  await supabaseAdmin
    .from('fyre_tracked_movie')
    .update({ history_start_date: first, history_complete: historyComplete(first, range) })
    .eq('moviemint_id', id)
    .then(() => undefined, () => undefined);
}

export async function processBackfills(deadline: number, onlyIds?: string[]): Promise<BackfillResult[]> {
  if (!onlyIds && (await bootstrapRunning())) return [];
  let q = supabaseAdmin
    .from('fyre_tracked_movie')
    .select('moviemint_id,bf_slug,backfill_status,release_date')
    .eq('match_status', 'matched')
    .not('bf_slug', 'is', null);
  // Scheduled: never a movie an admin stopped. Admin "refresh" (onlyIds): as asked.
  q = onlyIds ? q.in('moviemint_id', onlyIds) : q.in('backfill_status', ['requested', 'running']).neq('tracking_status', 'stopped');
  const { data: rows, error } = await q;
  if (error) throw new Error(`fyre_tracked_movie: ${error.message}`);
  const out: BackfillResult[] = [];
  if (!rows?.length) return out;

  const today = istDate(0);
  const ids = (rows as any[]).map((r) => r.moviemint_id as string);
  const slugs = (rows as any[]).map((r) => r.bf_slug as string);
  const [cursors, keys, mmDates] = await Promise.all([getCursors(ids), keysBySlug(slugs), moviemintReleaseDates(ids)]);

  const firstStored = new Map<string, string>();
  for (let i = 0; i < slugs.length; i += 200) {
    const { data } = await supabaseAdmin.from('bf_movie').select('slug,first_date').in('slug', slugs.slice(i, i + 200));
    for (const m of (data ?? []) as any[]) if (m.first_date) firstStored.set(m.slug, m.first_date);
  }

  const jobs: Job[] = [];
  for (const row of rows as any[]) {
    const id = row.moviemint_id as string;
    const slug = row.bf_slug as string;
    let cur = cursors.get(id) ?? null;
    if (!cur || cur.slug !== slug) {
      const release = row.release_date ?? mmDates.get(id) ?? null;
      const stored = firstStored.get(slug) ?? null;
      const range = historyRange(today, release);
      const start = range.start;
      const until = stored ? addDays(stored, -1) : null;
      const needSummary = !until || start <= until;
      cur = { phase: needSummary ? 'summary' : 'detail', next: needSummary ? start : null, from: start, until, slug, clamped: range.clamped };
    }
    jobs.push({ id, slug, cur, keys: keys.get(slug) ?? new Set() });
  }
  await supabaseAdmin.from('fyre_tracked_movie').update({ backfill_status: 'running' }).in('moviemint_id', ids);
  const byId = new Map(jobs.map((j) => [j.id, j]));

  // Phase 1: core daily totals -- one fetch per date for every movie that
  // still needs that date.
  const plan = summaryPlan(
    jobs.filter((j) => j.cur.phase === 'summary').map((j) => ({ id: j.id, next: j.cur.next, until: j.cur.until ?? null })),
    today
  );
  for (const [date, which] of plan) {
    if (Date.now() > deadline) break;
    const tracked = new Set<string>();
    for (const id of which) for (const k of byId.get(id)!.keys) tracked.add(k);
    const targets: SyncTarget[] = [
      { kind: 'boxoffice', date },
      { kind: 'advance', date }
    ];
    if (tracked.size) await syncBfilmy(targets, { posters: date === today, prune: false, recordState: false, tracked });
    for (const id of which) byId.get(id)!.cur.next = addDays(date, 1);
  }
  for (const j of jobs) {
    if (j.cur.phase !== 'summary' || !j.cur.next) continue;
    const end = j.cur.until && j.cur.until < today ? j.cur.until : today;
    if (j.cur.next > end) j.cur = { ...j.cur, phase: 'detail', next: null };
  }

  // Phase 2: breakdowns inside the retention window -- one fetch per
  // (kind, date) file for every movie that needs it.
  const detailJobs = jobs.filter((j) => j.cur.phase === 'detail');
  if (detailJobs.length && Date.now() < deadline) {
    const aliasMap = await fyreAliasMap(await fetchAliases());
    const windowStart = addDays(today, -BREAKDOWN_DAYS + 1);
    const groups = new Map<string, { kind: 'boxoffice' | 'advance'; date: string; ids: string[] }>();
    const todoCount = new Map<string, number>();
    for (const j of detailJobs) {
      const { data: have } = await supabaseAdmin.from('bf_movie_day').select('kind,date').eq('slug', j.slug).gte('date', windowStart);
      const { data: done } = await supabaseAdmin.from('bf_movie_day_detail').select('kind,date').eq('slug', j.slug).gte('date', windowStart);
      const doneSet = new Set((done ?? []).map((d: any) => `${d.kind}:${d.date}`));
      const todo = (have ?? []).filter((d: any) => !doneSet.has(`${d.kind}:${d.date}`) && (!j.cur.next || d.date >= j.cur.next));
      todoCount.set(j.id, todo.length);
      for (const d of todo as any[]) {
        const g = groups.get(`${d.date}:${d.kind}`) ?? { kind: d.kind, date: d.date, ids: [] as string[] };
        g.ids.push(j.id);
        groups.set(`${d.date}:${d.kind}`, g);
      }
    }
    const processed = new Map<string, number>();
    for (const [, g] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (Date.now() > deadline) break;
      const live = g.ids.filter((id) => !byId.get(id)!.error);
      if (!live.length) continue;
      const tracked = new Set<string>();
      const scope = new Set<string>();
      for (const id of live) {
        const j = byId.get(id)!;
        j.keys.forEach((k) => tracked.add(k));
        scope.add(j.slug);
      }
      const [r] = await syncDetail([{ kind: g.kind, date: g.date }], aliasMap, { tracked, scopeSlugs: scope, partial: true });
      for (const id of live) {
        const j = byId.get(id)!;
        if (r?.status === 'error') j.error = `detail ${g.kind} ${g.date}: ${r.error}`;
        else {
          j.cur.next = g.date;
          processed.set(id, (processed.get(id) ?? 0) + 1);
        }
      }
    }
    for (const j of detailJobs) if (!j.error && (processed.get(j.id) ?? 0) === (todoCount.get(j.id) ?? 0)) j.cur = { ...j.cur, phase: 'done' };
  }

  const now = new Date().toISOString();
  for (const j of jobs) {
    if (j.error) {
      await supabaseAdmin.from('fyre_tracked_movie').update({ backfill_status: 'error' }).eq('moviemint_id', j.id);
      await setCursor(j.id, j.cur);
      out.push({ id: j.id, status: `error: ${j.error.slice(0, 300)}` });
    } else if (j.cur.phase === 'done') {
      await recordHistory(j.id, j.slug, { start: j.cur.from, clamped: !!j.cur.clamped });
      await setCursor(j.id, null);
      await supabaseAdmin.from('fyre_tracked_movie').update({ backfill_status: 'done', backfill_done_at: now }).eq('moviemint_id', j.id);
      out.push({ id: j.id, status: 'done' });
    } else {
      await setCursor(j.id, j.cur);
      out.push({ id: j.id, status: j.cur.phase, next: j.cur.next });
    }
  }
  return out;
}
