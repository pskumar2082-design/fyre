// Imports BFILMY's show-level files into fyre's permanent aggregate tables
// (see supabase/migration_bfilmy_4.sql and ./detail.ts):
//   bf_movie_day_detail  per movie per day: venues, cities, states, PIC ...
//   bf_movie_breakdown   per movie per day per dimension (venue, language,
//                        format, language x state/city, show hour, price band)
//   bf_venue             venue dictionary
//   bf_detail_file       one row per imported file (traceability, reconcile
//                        result, whether aggregates are complete and final)
//   bf_show              raw show rows, only for a short window, only once a
//                        date is final. Nothing permanent reads this table.
//
// Always run AFTER the summary sync for the same date, so every movie
// already has its stable slug in bf_title_key.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchDetail } from './fetch';
import { normalizeDetailFile, reconcile, type BfDetailMovieDay, type DimRow, type VenueRef } from './detail';
import { applyStableSlugs, chunks, istDate, sizeBatches, type SyncTarget } from './sync';

export type DetailFileResult = {
  kind: SyncTarget['kind'];
  date: string;
  status: 'ok' | 'missing' | 'skipped' | 'error' | 'deferred';
  movies?: number;
  shows?: number;
  showsStored?: number;
  reconcileIssues?: number;
  sourceUpdated?: string | null;
  url?: string;
  error?: string;
};

export type DetailSyncOptions = {
  // Store raw show rows for final dates no older than this many days
  // (0 = never store show rows). Default 7.
  keepShowDays?: number;
  // Stop starting new work after this timestamp (ms since epoch), so a
  // time-limited cron run finishes cleanly; unfinished work is picked up
  // by the next run.
  deadline?: number;
  // Re-import a date even if it's already final and complete.
  force?: boolean;
  now?: Date;
  // Only these BFILMY title keys are imported (see lib/tracking.ts).
  tracked?: Set<string>;
  // The slugs this run is responsible for. Stale-row cleanup never touches
  // any other movie's rows.
  scopeSlugs?: Set<string>;
  // Backfilling one movie into an already-imported date: write only that
  // movie's aggregates; leave the date's file record and show rows alone.
  partial?: boolean;
};

const debug = (msg: string) => {
  if (process.env.BF_DEBUG) console.log(`[bfilmy-detail ${new Date().toISOString().slice(11, 19)}] ${msg}`);
};

// A date's file stops changing once the date is over (box office) or has
// started (advance: BFILMY freezes the advance file for date D at ~23:40
// on D-1).
export function isFinalDate(kind: SyncTarget['kind'], date: string, today: string): boolean {
  return kind === 'boxoffice' ? date < today : date <= today;
}

async function resolveVenueIds(venues: VenueRef[], date: string): Promise<Map<string, number>> {
  const ids = new Map<string, number>();
  const unique = [...new Map(venues.map((v) => [v.key, v])).values()];
  for (const batch of chunks(unique, 500)) {
    const payload = batch.map((v) => ({ key: v.key, name: v.name, city: v.city, state: v.state, chain: v.chain, sourceVenueId: null }));
    const { data, error } = await supabaseAdmin.rpc('bf_upsert_venues', { p_rows: payload, p_date: date });
    if (error) throw new Error(`bf_upsert_venues: ${error.message}`);
    for (const r of (data ?? []) as { id: number; venue_key: string }[]) ids.set(r.venue_key, Number(r.id));
  }
  for (const v of unique) if (!ids.has(v.key)) throw new Error(`venue id missing for ${v.key}`);
  return ids;
}

async function summaryTotalsFor(kind: string, date: string): Promise<{ bySlug: Map<string, { gross: number; sold: number; shows: number; totalSeats: number }>; updated: string | null }> {
  const bySlug = new Map<string, { gross: number; sold: number; shows: number; totalSeats: number }>();
  let updated: string | null = null;
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('bf_movie_day')
      .select('slug,totals,source_updated')
      .eq('kind', kind)
      .eq('date', date)
      .range(from, from + 999);
    if (error) throw new Error(`bf_movie_day totals: ${error.message}`);
    for (const r of (data ?? []) as any[]) {
      const t = r.totals ?? {};
      bySlug.set(r.slug, { gross: Number(t.gross) || 0, sold: Number(t.sold) || 0, shows: Number(t.shows) || 0, totalSeats: Number(t.totalSeats) || 0 });
      updated = updated ?? r.source_updated ?? null;
    }
    if (!data || data.length < 1000) break;
  }
  return { bySlug, updated };
}

function mapVenueKeys(rows: DimRow[], ids: Map<string, number>): DimRow[] {
  return rows.map((r) => [[ids.get(String(r[0][0]))!], ...r.slice(1)] as DimRow);
}

async function writeAggregates(
  days: (BfDetailMovieDay & { slug: string })[],
  ids: Map<string, number>,
  kind: string,
  date: string,
  url: string,
  sourceUpdated: string | null,
  scopeSlugs?: Set<string>
) {
  const syncedAt = new Date().toISOString();
  const detailRows = days.map((d) => ({
    slug: d.slug,
    kind,
    date,
    title: d.title,
    languages: d.languages,
    shows: d.summary.shows,
    seats: d.summary.seats,
    sold: d.summary.sold,
    gross: d.summary.gross,
    ff: d.summary.ff,
    hf: d.summary.hf,
    venues: d.summary.venues,
    cities: d.summary.cities,
    states: d.summary.states,
    pic: d.summary.pic,
    source_url: url,
    source_updated: sourceUpdated,
    synced_at: syncedAt
  }));
  for (const batch of sizeBatches(detailRows, 400_000, 200)) {
    const { error } = await supabaseAdmin.from('bf_movie_day_detail').upsert(batch, { onConflict: 'slug,kind,date' });
    if (error) throw new Error(`bf_movie_day_detail upsert: ${error.message}`);
  }

  const dimRows = days.flatMap((d) =>
    Object.entries(d.dims).map(([dimension, rows]) => ({
      slug: d.slug,
      kind,
      date,
      dimension,
      rows: dimension === 'venue' ? mapVenueKeys(rows as DimRow[], ids) : rows,
      source_url: url,
      source_updated: sourceUpdated,
      synced_at: syncedAt
    }))
  );
  for (const batch of sizeBatches(dimRows, 600_000, 200)) {
    const { error } = await supabaseAdmin.from('bf_movie_breakdown').upsert(batch, { onConflict: 'slug,kind,date,dimension' });
    if (error) throw new Error(`bf_movie_breakdown upsert: ${error.message}`);
  }

  // A movie in scope that's no longer in this date's file (e.g. merged into
  // another title after an alias fix) must not keep stale rows for it.
  const present = new Set(days.map((d) => d.slug));
  const stale = [...(scopeSlugs ?? [])].filter((s) => !present.has(s));
  for (let i = 0; i < stale.length; i += 100) {
    for (const table of ['bf_movie_day_detail', 'bf_movie_breakdown']) {
      const { error } = await supabaseAdmin.from(table).delete().eq('kind', kind).eq('date', date).in('slug', stale.slice(i, i + 100));
      if (error) throw new Error(`${table} stale cleanup: ${error.message}`);
    }
  }
}

// Writes raw show rows for one final date, resuming from `already` rows.
// Returns the number stored so far (== total when complete).
async function writeShows(days: (BfDetailMovieDay & { slug: string })[], ids: Map<string, number>, kind: string, date: string, already: number, deadline: number): Promise<number> {
  const rows = days.flatMap((d) =>
    d.shows.map((s) => ({
      kind,
      date,
      slug: d.slug,
      format: s.format,
      language: s.language,
      venue_id: ids.get(s.venueKey)!,
      show_time: s.time,
      hour: s.hour,
      audi: s.audi || null,
      session_id: s.sessionId || null,
      seats: s.seats,
      available: s.available,
      sold: s.sold,
      gross: s.gross,
      source_flag: s.sourceFlag
    }))
  );
  if (already === 0) {
    const { error } = await supabaseAdmin.from('bf_show').delete().eq('kind', kind).eq('date', date);
    if (error) throw new Error(`bf_show reset: ${error.message}`);
  }
  let stored = already;
  for (let i = already; i < rows.length; i += 1000) {
    if (Date.now() > deadline) break;
    const batch = rows.slice(i, i + 1000);
    const { error } = await supabaseAdmin.from('bf_show').insert(batch);
    if (error) throw new Error(`bf_show insert: ${error.message}`);
    stored = i + batch.length;
    const { error: e2 } = await supabaseAdmin.from('bf_detail_file').update({ shows_stored: stored }).eq('kind', kind).eq('date', date);
    if (e2) throw new Error(`bf_detail_file progress: ${e2.message}`);
  }
  return stored;
}

export async function syncDetail(targets: SyncTarget[], aliasMap: Map<string, string>, opts: DetailSyncOptions = {}): Promise<DetailFileResult[]> {
  const now = opts.now ?? new Date();
  const today = istDate(0, now);
  const keepShowDays = opts.keepShowDays ?? 7;
  const deadline = opts.deadline ?? Number.POSITIVE_INFINITY;
  const out: DetailFileResult[] = [];

  for (const t of targets) {
    if (Date.now() > deadline) {
      out.push({ ...t, status: 'deferred' });
      continue;
    }
    try {
      const final = isFinalDate(t.kind, t.date, today);
      const { data: prev } = await supabaseAdmin.from('bf_detail_file').select('*').eq('kind', t.kind).eq('date', t.date).maybeSingle();
      // Raw show rows: box office for the last N final days and for today's
      // live day; advance while the date is still open. Live dates are
      // refreshed at most every 2 hours (they change all day). The public
      // show list reads only these stored rows -- visitors never cause a
      // BFILMY request.
      const advanceOpen = t.kind === 'advance' && t.date >= today;
      const liveToday = t.kind === 'boxoffice' && !final && t.date === today;
      const advanceStale = !prev?.synced_at || Date.now() - Date.parse(prev.synced_at) > 2 * 3600_000;
      const wantShows =
        !opts.partial &&
        keepShowDays > 0 &&
        ((t.kind === 'boxoffice' && final && t.date >= istDate(-keepShowDays, now)) || ((advanceOpen || liveToday) && (advanceStale || !prev?.shows_stored)));
      const showsDone = prev && prev.shows_total > 0 && prev.shows_stored >= prev.shows_total;
      if (!opts.force && !opts.partial && prev?.final && prev?.aggregates_complete && (!wantShows || showsDone)) {
        out.push({ ...t, status: 'skipped', sourceUpdated: prev.source_updated });
        continue;
      }

      debug(`fetch ${t.kind} ${t.date}`);
      const got = await fetchDetail(t.kind, t.date);
      if (!got) {
        out.push({ ...t, status: 'missing' });
        continue;
      }
      const sourceUpdated = got.file.last_updated ?? null;
      const days = (normalizeDetailFile(got.file, t.kind, t.date, aliasMap) as (BfDetailMovieDay & { slug: string })[]).filter(
        (d) => !opts.tracked || opts.tracked.has(d.key)
      );
      for (const d of days) d.slug = '';
      await applyStableSlugs(days);
      debug(`  ${days.length} movies, ${got.file.data.length} shows`);

      const sameFile = prev && prev.source_updated === sourceUpdated && prev.source_url === got.url;
      const needAggregates = opts.partial || opts.force || !prev?.aggregates_complete || !sameFile || !prev?.final;
      const venueRefs = days.flatMap((d) => d.venues);
      const ids = await resolveVenueIds(venueRefs, t.date);

      let issues: ReturnType<typeof reconcile> = prev?.reconcile_issues ?? [];
      const summary = await summaryTotalsFor(t.kind, t.date);
      if (needAggregates) {
        // Reconcile by slug: the summary rows are stored per slug.
        const bySlugKey = new Map(days.map((d) => [d.slug, d.key]));
        const totalsByKey = new Map(
          [...summary.bySlug].filter(([slug]) => !opts.scopeSlugs || opts.scopeSlugs.has(slug)).map(([slug, v]) => [bySlugKey.get(slug) ?? `slug:${slug}`, v])
        );
        // Only meaningful when both files are the same BFILMY snapshot; a
        // live day's summary may have been stored at a different time.
        issues =
          summary.updated && summary.updated === sourceUpdated
            ? reconcile(days, totalsByKey)
            : [{ key: '*', title: `not compared: summary ${summary.updated ?? 'missing'} vs detail ${sourceUpdated ?? '?'}`, field: 'snapshot-differs', detail: 0, summary: 0 }];

        const fileRow = {
          kind: t.kind,
          date: t.date,
          source_url: got.url,
          source_updated: sourceUpdated,
          summary_updated: summary.updated,
          movies: days.length,
          shows_total: days.reduce((n, d) => n + d.shows.length, 0),
          shows_stored: sameFile ? prev?.shows_stored ?? 0 : 0,
          reconcile_issues: issues.slice(0, 50),
          aggregates_complete: false,
          final,
          synced_at: new Date().toISOString()
        };
        if (opts.partial) {
          await writeAggregates(days, ids, t.kind, t.date, got.url, sourceUpdated, opts.scopeSlugs);
        } else {
          const { error: e1 } = await supabaseAdmin.from('bf_detail_file').upsert(fileRow, { onConflict: 'kind,date' });
          if (e1) throw new Error(`bf_detail_file: ${e1.message}`);
          await writeAggregates(days, ids, t.kind, t.date, got.url, sourceUpdated, opts.scopeSlugs);
          const { error: e2 } = await supabaseAdmin.from('bf_detail_file').update({ aggregates_complete: true }).eq('kind', t.kind).eq('date', t.date);
          if (e2) throw new Error(`bf_detail_file complete: ${e2.message}`);
        }
        debug(`  aggregates written (${issues.length} reconcile issues)`);
      }

      let showsStored = !opts.partial && sameFile ? prev?.shows_stored ?? 0 : 0;
      const showTotal = days.reduce((n, d) => n + d.shows.length, 0);
      if (wantShows && showsStored < showTotal) {
        showsStored = await writeShows(days, ids, t.kind, t.date, showsStored, deadline);
        debug(`  shows stored ${showsStored}/${showTotal}`);
      }

      out.push({
        ...t,
        status: 'ok',
        movies: days.length,
        shows: showTotal,
        showsStored,
        reconcileIssues: issues.filter((i) => i.field !== 'snapshot-differs').length,
        sourceUpdated,
        url: got.url
      });
    } catch (err: any) {
      out.push({ ...t, status: 'error', error: err?.message ?? String(err) });
    }
  }
  return out;
}
