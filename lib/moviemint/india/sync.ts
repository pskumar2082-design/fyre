// MovieMint India import (catalog link + every India figure) -> mmi_* tables.
//
// Pipeline (each scheduled run, see app/api/cron/moviemint/route.ts, or the
// local runner scripts/moviemint-india.ts):
//   1. MovieMint lists, at most every CATALOG_TTL: /tracked (entries kept
//      whole), /advance, and the sitemap (movies with a MovieMint page that
//      left both lists). If MovieMint is unreachable the run stops here and
//      the site keeps the last good catalog and data.
//   2. Link every MovieMint movie to its canonical Fyre movie (link.ts):
//      existing Fyre ids and URLs are kept, missing movies are created,
//      uncertain ones go to admin review.
//   3. Pages, paced (a page budget per run, a polite gap between requests,
//      stop at the first refusal), in plan.ts order: live views, advance
//      show dates, first fetches, cumulative reports, final day reports for
//      every tracked-window date, then later-day captures.
//   4. mmi_movie summaries for every movie touched.
// Every dated request is checked: a page for another date (MovieMint's
// silent fallback) is recorded as missing and never stored. Idempotent:
// every write is an upsert; nothing is ever deleted.
import axios from 'axios';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { MOVIEMINT_ORIGIN, TRACKED_URL, fetchTrackedList, parseTrackedPage, type MovieMintMovie } from '../catalog';
import { exactKey } from '../match';
import { CUMULATIVE, MmiDateMismatch, MmiFormatError, parseAdvanceList, parseMoviePage, parseSitemapMovieIds, parseTrackedEntries, type MmiAdvanceListing, type MmiPage } from './parse';
import { addDays, cumulativeReport, movieRow, pageRows, snapshotRow, type DayRow, type StoredDay, type StoredTotals } from './normalize';
import { planLinks, type FyreEntry, type LinkDecision, type LinkRow, type MmEntry } from './link';
import { MMI_BREAKDOWN_DAYS, planTasks, type Fetched, type LinkedMovie, type PageRequest, type StoredState, type Task } from './plan';

export { MMI_BREAKDOWN_DAYS, type LinkedMovie, type Task };

const db = supabaseAdmin as any;
const USER_AGENT = 'fyre.co.in catalog sync (+https://fyre.co.in)';
const INTERACTIVE_CHALLENGE = /attention required|cf-chl-widget|g-recaptcha|h-captcha|verify you are human/i;
const CATALOG_TTL_MS = Number(process.env.MMI_CATALOG_TTL_MIN ?? 360) * 60_000;
const SITEMAP_NEW_PER_RUN = Number(process.env.MMI_SITEMAP_NEW_PER_RUN ?? 10);

export function istToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, label: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function selectAll(table: string, columns: string, apply: (q: any) => any = (q) => q): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const data = await must<any[]>(apply(db.from(table).select(columns)).range(from, from + 999), table);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The second migration (day_window, mmi_snapshot, ...) must be in place
// before this importer writes anything.
export async function ensureSchema(): Promise<void> {
  const a = await db.from('mmi_movie_day').select('day_window').limit(1);
  const b = await db.from('mmi_snapshot').select('slug').limit(1);
  const c = await db.from('mm_movie').select('on_sitemap,listing').limit(1);
  const err = a.error ?? b.error ?? c.error;
  if (err) throw new Error(`MovieMint schema not ready (${err.message}). Run supabase/migration_moviemint_india_2.sql first.`);
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

export class MovieMintRefused extends Error {}

export const mmiSourceLog: { at: string; path: string; status: number | string; ms: number }[] = [];

async function fetchText(path: string, timeoutMs = 20_000, accept = 'text/html'): Promise<string> {
  const t0 = Date.now();
  let status: number | string = 'error';
  try {
    const res = await axios.get<string>(`${MOVIEMINT_ORIGIN}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: accept },
      timeout: timeoutMs,
      responseType: 'text',
      maxRedirects: 2,
      validateStatus: () => true
    });
    status = res.status;
    const html = String(res.data ?? '');
    if (res.status === 403 || res.status === 429 || INTERACTIVE_CHALLENGE.test(html)) throw new MovieMintRefused(`MovieMint refused ${path} (HTTP ${res.status}); stopping this run`);
    if (res.status !== 200) throw new Error(`MovieMint ${path} answered HTTP ${res.status}`);
    return html;
  } finally {
    mmiSourceLog.push({ at: new Date().toISOString(), path, status, ms: Date.now() - t0 });
    if (mmiSourceLog.length > 500) mmiSourceLog.splice(0, mmiSourceLog.length - 500);
  }
}

export function pagePath(r: Pick<PageRequest, 'movieId' | 'kind' | 'date'>): string {
  const q = new URLSearchParams();
  if (r.kind === 'advance') q.set('kind', 'advance');
  if (r.date) q.set('date', r.date === CUMULATIVE ? CUMULATIVE : r.date.replace(/-/g, ''));
  const qs = q.toString();
  return `/movie/${encodeURIComponent(r.movieId)}${qs ? `?${qs}` : ''}`;
}

// A dated request returns that date or throws MmiDateMismatch.
export async function fetchMoviePage(r: PageRequest, timeoutMs = 20_000): Promise<MmiPage> {
  const html = await fetchText(pagePath(r), timeoutMs);
  return parseMoviePage(html, r.movieId, r.kind, r.date);
}

// ---------------------------------------------------------------------------
// Catalog: /tracked + /advance + sitemap
// ---------------------------------------------------------------------------

export async function fetchAdvanceList(): Promise<MmiAdvanceListing[]> {
  return parseAdvanceList(await fetchText('/advance'));
}

export async function syncCatalogLists(opts: { budget?: { left: number } } = {}): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  // /tracked -- identity rows (same rules as lib/moviemint/sync.ts) + the
  // whole entry as published.
  const trackedHtml = await fetchText(new URL(TRACKED_URL).pathname);
  const tracked = parseTrackedPage(trackedHtml);
  if (tracked.length < 10) throw new Error(`MovieMint /tracked parsed only ${tracked.length} movies; page format may have changed`);
  const entries = parseTrackedEntries(trackedHtml);
  for (const batch of chunks(tracked, 200)) {
    await must(
      db.from('mm_movie').upsert(
        batch.map((m) => ({
          moviemint_id: m.id,
          title: m.title,
          language: m.language,
          release_date: m.releaseDate,
          poster: m.poster,
          badge: m.badge,
          source_url: m.sourceUrl,
          last_tracked_date: m.lastTrackedDate,
          on_list: true,
          listing: entries.has(m.id) ? { ...entries.get(m.id), seenAt: now } : null, // seenAt: when Fyre read this published total
          last_seen: now,
          updated_at: now
        })),
        { onConflict: 'moviemint_id' }
      ),
      'mm_movie tracked'
    );
  }
  const onList = new Set(tracked.map((m) => m.id));
  const known = await selectAll('mm_movie', 'moviemint_id,on_list,on_advance,on_sitemap');
  const offList = known.filter((r) => r.on_list && !onList.has(r.moviemint_id)).map((r) => r.moviemint_id);
  for (const batch of chunks(offList, 200)) await must(db.from('mm_movie').update({ on_list: false, updated_at: now }).in('moviemint_id', batch), 'mm_movie off list');
  await db.from('bf_sync_state').upsert({ key: 'last_moviemint_sync', value: { fetchedAt: now, movies: tracked.length, offList: offList.length, errors: [] }, updated_at: now }, { onConflict: 'key' });

  // /advance
  const listing = await fetchAdvanceList();
  const have = new Set(known.map((r) => r.moviemint_id).concat(tracked.map((m) => m.id)));
  const freshAdv = listing.filter((a) => !have.has(a.id));
  if (freshAdv.length)
    await must(
      db.from('mm_movie').upsert(
        freshAdv.map((a) => ({
          moviemint_id: a.id,
          title: a.title,
          language: a.language,
          release_date: a.releaseDate,
          poster: a.poster,
          badge: a.badge,
          source_url: `${MOVIEMINT_ORIGIN}/movie/${a.id}`,
          on_list: false,
          listing: a.entry ?? null,
          last_seen: now,
          updated_at: now
        })),
        { onConflict: 'moviemint_id' }
      ),
      'mm_movie advance'
    );
  const advIds = listing.map((a) => a.id);
  if (advIds.length) await must(db.from('mm_movie').update({ on_advance: true, advance_seen_at: now }).in('moviemint_id', advIds), 'mm_movie on_advance');
  const offAdv = known.filter((r) => r.on_advance && !advIds.includes(r.moviemint_id)).map((r) => r.moviemint_id);
  if (offAdv.length) await must(db.from('mm_movie').update({ on_advance: false }).in('moviemint_id', offAdv), 'mm_movie off advance');

  // sitemap: movies with a MovieMint page that left both lists. A new id is
  // identified from its own page (config) -- never from the id alone.
  const sitemapIds = parseSitemapMovieIds(await fetchText('/sitemap.xml', 20_000, 'application/xml'));
  const sm = new Set(sitemapIds);
  if (sitemapIds.length) await must(db.from('mm_movie').update({ on_sitemap: true, sitemap_seen_at: now }).in('moviemint_id', sitemapIds.filter((id) => have.has(id) || advIds.includes(id))), 'mm_movie on_sitemap');
  const offSm = known.filter((r) => r.on_sitemap && !sm.has(r.moviemint_id)).map((r) => r.moviemint_id);
  if (offSm.length) await must(db.from('mm_movie').update({ on_sitemap: false }).in('moviemint_id', offSm), 'mm_movie off sitemap');
  const unknownIds = sitemapIds.filter((id) => !have.has(id) && !advIds.includes(id));
  let identified = 0;
  const budget = opts.budget ?? { left: SITEMAP_NEW_PER_RUN };
  for (const id of unknownIds) {
    if (budget.left <= 0 || identified >= SITEMAP_NEW_PER_RUN) break;
    budget.left--;
    await sleep(1200);
    try {
      const page = await fetchMoviePage({ movieId: id, kind: 'boxoffice', date: null, page: 'series' });
      await must(
        db.from('mm_movie').upsert(
          {
            moviemint_id: id,
            title: page.title ?? id,
            language: page.language,
            release_date: page.releaseDate,
            poster: page.poster,
            badge: page.badge,
            source_url: `${MOVIEMINT_ORIGIN}/movie/${id}`,
            on_list: false,
            on_sitemap: true,
            sitemap_seen_at: now,
            last_tracked_date: page.series[page.series.length - 1]?.date ?? null,
            listing: { list: 'sitemap' },
            last_seen: now,
            updated_at: now
          },
          { onConflict: 'moviemint_id' }
        ),
        'mm_movie sitemap'
      );
      identified++;
    } catch (err) {
      if (err instanceof MovieMintRefused) throw err;
    }
  }
  return { tracked: tracked.length, offList: offList.length, advance: listing.length, sitemap: sitemapIds.length, sitemapNew: identified, sitemapPending: Math.max(0, unknownIds.length - identified) };
}

// ---------------------------------------------------------------------------
// Catalog link
// ---------------------------------------------------------------------------

export type CatalogState = {
  mm: (MmEntry & { onList: boolean; onAdvance: boolean; onSitemap: boolean; poster: string | null; lastTrackedDate: string | null })[];
  fyre: (FyreEntry & { trackingStatus: string; metadata: any })[];
  links: LinkRow[];
  takenSlugs: Set<string>;
};

export async function loadCatalogState(): Promise<CatalogState> {
  const [mmRows, fyreRows, aliasRows, linkRows] = await Promise.all([
    selectAll('mm_movie', 'moviemint_id,title,language,release_date,poster,badge,on_list,on_advance,on_sitemap,last_tracked_date').catch((err) => {
      // before migration 2 (dry run): no on_sitemap yet
      if (!/on_sitemap|on_advance/.test(String(err?.message))) throw err;
      return selectAll('mm_movie', 'moviemint_id,title,language,release_date,poster,badge,on_list,last_tracked_date');
    }),
    selectAll('fyre_tracked_movie', 'moviemint_id,bf_slug,title,origin,release_date,first_source_date,languages,tracking_status,match_status,metadata'),
    selectAll('fyre_movie_alias', 'movie_id,source_title,decision', (q) => q.in('decision', ['created', 'matched'])),
    selectAll('mmi_catalog', 'moviemint_id,movie_id,slug,link_status,link_method,link_note').catch((err) => {
      if (/mmi_catalog/.test(String(err?.message)) && /exist|find|schema cache/i.test(String(err?.message))) return [] as any[];
      throw err;
    })
  ]);
  const titles = new Map<string, string[]>();
  for (const a of aliasRows) titles.set(a.movie_id, [...(titles.get(a.movie_id) ?? []), a.source_title]);
  const taken = new Set<string>();
  for (const f of fyreRows) if (f.bf_slug) taken.add(f.bf_slug);
  return {
    mm: mmRows.map((m) => ({
      id: m.moviemint_id,
      title: m.title,
      language: m.language ?? null,
      releaseDate: m.release_date ?? null,
      badge: m.badge ?? null,
      onList: !!m.on_list,
      onAdvance: !!m.on_advance,
      onSitemap: !!m.on_sitemap,
      poster: m.poster ?? null,
      lastTrackedDate: m.last_tracked_date ?? null
    })),
    fyre: fyreRows.map((f) => ({
      movieId: f.moviemint_id,
      slug: f.bf_slug ?? null,
      title: f.title ?? null,
      origin: f.origin ?? 'moviemint',
      releaseDate: f.release_date ?? null,
      firstSourceDate: f.first_source_date ?? null,
      languages: f.languages ?? [],
      titles: titles.get(f.moviemint_id) ?? [],
      trackingStatus: f.tracking_status,
      metadata: f.metadata ?? {}
    })),
    links: linkRows,
    takenSlugs: taken
  };
}

export function planCatalog(state: CatalogState): LinkDecision[] {
  const aliasMap = new Map<string, string>();
  return planLinks(state.mm, state.fyre, state.links, state.takenSlugs, (t) => exactKey(t, aliasMap));
}

export async function applyCatalogPlan(state: CatalogState, plan: LinkDecision[]): Promise<{ linked: number; created: number; review: number }> {
  const now = new Date().toISOString();
  const mmBy = new Map(state.mm.map((m) => [m.id, m]));
  let linked = 0;
  let created = 0;
  let review = 0;
  for (const d of plan) {
    if (d.action === 'keep') continue;
    const mm = mmBy.get(d.moviemintId)!;
    if (d.action === 'create') {
      // A new canonical Fyre movie for a MovieMint movie Fyre did not have.
      // match_status stays 'unmatched' (that column is the BFILMY India
      // match) and bf_slug stays empty, so the BFILMY policy never shows it;
      // under the MovieMint policy mmi_catalog makes it public.
      const { error } = await db.from('fyre_tracked_movie').upsert(
        {
          moviemint_id: d.movieId,
          origin: 'moviemint',
          title: mm.title,
          release_date: mm.releaseDate,
          release_year: mm.releaseDate ? Number(mm.releaseDate.slice(0, 4)) : null,
          languages: mm.language ? [mm.language] : null,
          match_status: 'unmatched',
          tracking_status: 'pending',
          match_note: 'Created from MovieMint (MovieMint India policy)',
          created_from: `moviemint:${d.moviemintId}`,
          metadata: { poster: mm.poster ?? null, source: 'moviemint' },
          metadata_status: mm.poster && mm.releaseDate ? 'complete' : 'incomplete',
          updated_at: now
        },
        { onConflict: 'moviemint_id', ignoreDuplicates: true }
      );
      if (error) throw new Error(`fyre_tracked_movie create ${d.moviemintId}: ${error.message}`);
      created++;
    }
    const status = d.action === 'review' ? 'needs_review' : 'linked';
    const { error } = await db.from('mmi_catalog').upsert(
      { moviemint_id: d.moviemintId, movie_id: d.movieId, slug: d.slug, link_status: status, link_method: d.method === 'kept' ? null : d.method, link_note: d.note, candidates: d.candidates, updated_at: now },
      { onConflict: 'moviemint_id' }
    );
    if (error) throw new Error(`mmi_catalog ${d.moviemintId}: ${error.message}`);
    if (status === 'linked' && d.movieId) {
      linked++;
      // The MovieMint title as a confirmed title of the Fyre movie (once):
      // USA matching uses it as a spelling variant.
      const { data: have } = await db.from('fyre_movie_alias').select('id').eq('movie_id', d.movieId).eq('source', 'moviemint').eq('source_movie_id', d.moviemintId).limit(1);
      if (!have?.length) {
        await db.from('fyre_movie_alias').insert({
          movie_id: d.movieId,
          source: 'moviemint',
          source_title: mm.title,
          source_movie_id: d.moviemintId,
          match_method: d.method,
          match_confidence: d.method === 'title_date' ? 'high' : null,
          decision: d.action === 'create' ? 'created' : 'matched',
          decided_by: 'moviemint-india-sync',
          note: d.note
        });
      }
    } else review++;
  }
  return { linked, created, review };
}

// ---------------------------------------------------------------------------
// Work queue
// ---------------------------------------------------------------------------

export async function loadLinkedMovies(state?: CatalogState): Promise<LinkedMovie[]> {
  const s = state ?? (await loadCatalogState());
  const mmBy = new Map(s.mm.map((m) => [m.id, m]));
  const fyreBy = new Map(s.fyre.map((f) => [f.movieId, f]));
  const links = await selectAll('mmi_catalog', 'moviemint_id,movie_id,slug,link_status', (q) => q.eq('link_status', 'linked'));
  return links
    .filter((l) => l.movie_id && l.slug && mmBy.has(l.moviemint_id))
    .map((l) => {
      const m = mmBy.get(l.moviemint_id)!;
      const f = fyreBy.get(l.movie_id);
      return {
        moviemintId: l.moviemint_id,
        movieId: l.movie_id,
        slug: l.slug,
        title: m.title,
        poster: m.poster ?? f?.metadata?.poster ?? null,
        language: m.language,
        releaseDate: m.releaseDate,
        onList: m.onList,
        onAdvance: m.onAdvance,
        onSitemap: m.onSitemap,
        lastTrackedDate: m.lastTrackedDate,
        stopped: f?.trackingStatus === 'stopped'
      };
    });
}

export async function loadStoredState(today: string): Promise<Map<string, StoredState>> {
  const [movies, finals] = await Promise.all([
    selectAll('mmi_movie', 'slug,available_dates,last_date,window_end,meta'),
    selectAll('mmi_movie_day', 'slug,date,day_window', (q) => q.eq('kind', 'boxoffice').eq('breakdown_status', 'final').lt('date', today))
  ]);
  const fin = new Map<string, Set<string>>();
  const later = new Map<string, Set<string>>();
  for (const r of finals) {
    const m = r.day_window === 'later' ? later : fin;
    m.set(r.slug, (m.get(r.slug) ?? new Set()).add(r.date));
  }
  return new Map(
    movies.map((r) => [
      r.slug,
      {
        availableDates: (r.available_dates ?? []) as string[],
        finalDates: fin.get(r.slug) ?? new Set<string>(),
        laterFinal: later.get(r.slug) ?? new Set<string>(),
        windowEnd: r.window_end ?? null,
        latestSnapshot: r.meta?.latestSnapshot ?? null,
        advanceDates: (r.meta?.advanceDates ?? []) as string[],
        lastDate: r.last_date ?? null
      }
    ])
  );
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

async function storedDays(slug: string): Promise<Map<string, { totals: Partial<StoredTotals>; status: string; inSource: boolean; window: string }>> {
  const rows = await selectAll('mmi_movie_day', 'kind,date,totals,breakdown_status,in_source,day_window', (q) => q.eq('slug', slug));
  return new Map(rows.map((r) => [`${r.kind}:${r.date}`, { totals: r.totals ?? {}, status: r.breakdown_status, inSource: r.in_source, window: r.day_window }]));
}

export type WriteResult = { rows: number; breakdowns: number; dropped: number; snapshot: boolean; meta: Record<string, unknown> };

// onlyDate: a per-date report -- write that date only (the series page
// refreshes every window date's totals itself).
export async function writePage(page: MmiPage, m: LinkedMovie, today: string, onlyDate: string | null = null): Promise<WriteResult> {
  const now = new Date().toISOString();
  const ctx = { slug: m.slug, moviemintId: m.moviemintId, title: m.title, now, today };
  const meta: Record<string, unknown> = {
    backdrop: page.meta.backdrop,
    genres: page.meta.genres,
    tmdbId: page.meta.tmdbId,
    note: page.note,
    badge: page.badge,
    searchName: page.meta.searchName,
    trackedFloorExempt: page.meta.trackedFloorExempt,
    hideTrackedSwitch: page.meta.hideTrackedSwitch,
    source: page.day?.source ?? null
  };

  if (page.day?.date === CUMULATIVE) {
    const report = cumulativeReport(page);
    await must(db.from('mmi_movie').update({ cumulative: report, cumulative_updated: page.day.lastUpdated, updated_at: now }).eq('slug', m.slug), 'mmi_movie cumulative');
    return { rows: 0, breakdowns: 0, dropped: 0, snapshot: false, meta };
  }

  const have = await storedDays(m.slug);
  const totalsBy = new Map([...have.entries()].map(([k, v]) => [k, v.totals]));
  const rows = pageRows(page, ctx, totalsBy).filter((r) => !onlyDate || r.date === onlyDate);
  const plain: Omit<DayRow, 'breakdown' | 'breakdown_status' | 'breakdown_synced_at'>[] = [];
  const withBd: DayRow[] = [];
  for (const r of rows) {
    const prev = have.get(`${r.kind}:${r.date}`);
    // Never replace a final breakdown with a live snapshot.
    if (r.breakdown && !(prev?.status === 'final' && r.breakdown_status !== 'final')) withBd.push(r);
    else {
      const { breakdown: _b, breakdown_status: _s, breakdown_synced_at: _t, ...rest } = r;
      plain.push(rest);
    }
  }
  for (const batch of chunks(plain, 200)) await must(db.from('mmi_movie_day').upsert(batch, { onConflict: 'slug,kind,date' }), 'mmi_movie_day');
  for (const batch of chunks(withBd, 20)) await must(db.from('mmi_movie_day').upsert(batch, { onConflict: 'slug,kind,date' }), 'mmi_movie_day');

  // Window dates MovieMint's series no longer lists: kept, flagged. Later
  // days are never in the series and are not touched here.
  let dropped = 0;
  if (page.kind === 'boxoffice' && page.series.length && !onlyDate) {
    const inSeries = new Set(page.series.map((p) => p.date));
    const gone = [...have.entries()].filter(([k, v]) => k.startsWith('boxoffice:') && v.window !== 'later' && v.inSource && !inSeries.has(k.slice(10))).map(([k]) => k.slice(10));
    if (gone.length) {
      await must(db.from('mmi_movie_day').update({ in_source: false }).eq('slug', m.slug).eq('kind', 'boxoffice').in('date', gone), 'mmi_movie_day in_source');
      dropped = gone.length;
    }
    const back = page.series.filter((p) => have.get(`boxoffice:${p.date}`)?.inSource === false).map((p) => p.date);
    if (back.length) await must(db.from('mmi_movie_day').update({ in_source: true }).eq('slug', m.slug).eq('kind', 'boxoffice').in('date', back), 'mmi_movie_day in_source');
    if (page.day) meta.latestSnapshot = page.day.date;
    meta.windowDates = page.series.length;
  }
  if (page.kind === 'advance') meta.advanceDates = page.availableDates;

  const snap = snapshotRow(page, ctx);
  if (snap) await must(db.from('mmi_snapshot').upsert(snap, { onConflict: 'moviemint_id,kind,show_date,source_updated', ignoreDuplicates: true }), 'mmi_snapshot');
  return { rows: rows.length, breakdowns: withBd.length, dropped, snapshot: !!snap, meta };
}

export async function refreshMovie(m: LinkedMovie, today: string, opts: { availableDates?: string[]; meta?: Record<string, unknown> } = {}): Promise<void> {
  // Only the language/format lists of each breakdown are needed (ranking);
  // the city lists are never pulled here.
  const rows = await selectAll('mmi_movie_day', 'kind,date,totals,breakdown_status,source_updated,synced_at,day_window,langs:breakdown->languages,fmts:breakdown->formats', (q) =>
    q.eq('slug', m.slug).eq('in_source', true)
  );
  const { data: prev } = await db.from('mmi_movie').select('available_dates,meta,official').eq('slug', m.slug).maybeSingle();
  const days: StoredDay[] = rows.map((r) => ({
    kind: r.kind,
    date: r.date,
    totals: r.totals ?? {},
    breakdown: { languages: r.langs ?? [], formats: r.fmts ?? [] },
    breakdown_status: r.breakdown_status,
    source_updated: r.source_updated,
    synced_at: r.synced_at,
    day_window: r.day_window
  }));
  if (!days.length) return;
  const row = movieRow(
    { slug: m.slug, moviemintId: m.moviemintId, title: m.title, poster: m.poster, language: m.language, releaseDate: m.releaseDate, availableDates: opts.availableDates ?? ((prev?.available_dates ?? []) as string[]) },
    days,
    today
  );
  // MovieMint's own published window totals (the /tracked entry), kept to
  // reconcile Fyre's sum against.
  const { data: mm } = await db.from('mm_movie').select('listing').eq('moviemint_id', m.moviemintId).maybeSingle();
  const l = mm?.listing as any;
  const official =
    l && l.list === 'tracked'
      ? { gross: l.gross ?? null, ticketsSold: l.ticketsSold ?? null, shows: l.shows ?? null, totalSeats: l.totalSeats ?? null, avgOccupancy: l.avgOccupancy ?? null, topState: l.topState ?? null, sourceDate: l.sourceDate ?? null, seenAt: l.seenAt ?? null }
      : (prev?.official ?? null);
  const meta = { ...(prev?.meta ?? {}), ...Object.fromEntries(Object.entries(opts.meta ?? {}).filter(([, v]) => v !== undefined)) };
  await must(db.from('mmi_movie').upsert({ ...row, official, meta }, { onConflict: 'slug' }), 'mmi_movie');
}

async function recordFetch(movieId: string, page: string, ok: boolean, error: string | null, sourceUpdated: string | null) {
  await db.from('mmi_fetch').upsert({ moviemint_id: movieId, page, fetched_at: new Date().toISOString(), ok, error, source_updated: sourceUpdated }, { onConflict: 'moviemint_id,page' });
}

async function recordUnknown(fields: string[], movie: string) {
  if (!fields.length) return;
  const { data } = await db.from('bf_sync_state').select('value').eq('key', 'mmi_unknown_fields').maybeSingle();
  const map = ((data?.value as any)?.fields ?? {}) as Record<string, { firstSeen: string; lastSeen: string; movie: string; count: number }>;
  const now = new Date().toISOString();
  for (const f of fields) map[f] = { firstSeen: map[f]?.firstSeen ?? now, lastSeen: now, movie, count: (map[f]?.count ?? 0) + 1 };
  await db.from('bf_sync_state').upsert({ key: 'mmi_unknown_fields', value: { fields: map }, updated_at: now }, { onConflict: 'key' });
}

// ---------------------------------------------------------------------------
// Lock (never two MovieMint runs at once)
// ---------------------------------------------------------------------------

export async function acquireMmiLock(ttlMs = 120_000): Promise<string | null> {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { data } = await db.from('bf_sync_state').select('value').eq('key', 'mmi_sync_lock').maybeSingle();
  const held = data?.value as { token?: string; until?: number } | null;
  if (held?.until && held.until > Date.now()) return null;
  await db.from('bf_sync_state').upsert({ key: 'mmi_sync_lock', value: { token, until: Date.now() + ttlMs }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  const { data: again } = await db.from('bf_sync_state').select('value').eq('key', 'mmi_sync_lock').maybeSingle();
  return (again?.value as any)?.token === token ? token : null;
}

export async function releaseMmiLock(token: string): Promise<void> {
  const { data } = await db.from('bf_sync_state').select('value').eq('key', 'mmi_sync_lock').maybeSingle();
  if ((data?.value as any)?.token === token) await db.from('bf_sync_state').upsert({ key: 'mmi_sync_lock', value: { token: null, until: 0 }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

// ---------------------------------------------------------------------------
// One run
// ---------------------------------------------------------------------------

export type RunOptions = {
  deadline: number;
  maxPages?: number;
  delayMs?: number;
  forceCatalog?: boolean;
  only?: string[]; // MovieMint ids
  reasons?: Task['reason'][];
};

export type RunResult = {
  startedAt: string;
  finishedAt: string;
  catalog: unknown;
  links: { linked: number; created: number; review: number } | null;
  pages: { page: string; movie: string; ok: boolean; rows?: number; breakdowns?: number; missing?: boolean; error?: string }[];
  refreshed: number;
  pending: number;
  pendingByReason: Record<string, number>;
  unknownFields: string[];
  stoppedBy: string | null;
  errors: string[];
};

export async function runMovieMintIndia(opts: RunOptions): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const pages: RunResult['pages'] = [];
  const today = istToday();
  let stoppedBy: string | null = null;
  const unknownFields = new Set<string>();

  await ensureSchema();

  // 1. Catalog lists (failure = stop; nothing below runs, nothing is cleared)
  let catalog: unknown = null;
  try {
    const { data } = await db.from('bf_sync_state').select('value').eq('key', 'last_moviemint_sync').maybeSingle();
    const last = Date.parse((data?.value as any)?.fetchedAt ?? '') || 0;
    if (opts.forceCatalog || Date.now() - last > CATALOG_TTL_MS) catalog = await syncCatalogLists();
    else catalog = { skipped: 'fresh', fetchedAt: (data?.value as any)?.fetchedAt };
  } catch (err: any) {
    const msg = `catalog: MovieMint unavailable (${String(err?.message ?? err).slice(0, 200)}); kept the last good catalog and data`;
    const result: RunResult = { startedAt, finishedAt: new Date().toISOString(), catalog: null, links: null, pages, refreshed: 0, pending: 0, pendingByReason: {}, unknownFields: [], stoppedBy: 'catalog', errors: [msg] };
    await saveResult(result);
    return result;
  }

  // 2. Link
  const state = await loadCatalogState();
  const plan = planCatalog(state);
  const links = await applyCatalogPlan(state, plan);

  // 3. Pages
  let movies = await loadLinkedMovies(state);
  if (opts.only?.length) movies = movies.filter((m) => opts.only!.includes(m.moviemintId));
  const bySlug = new Map(movies.map((m) => [m.slug, m]));
  const fetchRows = await selectAll('mmi_fetch', 'moviemint_id,page,fetched_at,ok,error');
  const fetched: Fetched = new Map(fetchRows.map((r) => [`${r.moviemint_id}|${r.page}`, { at: Date.parse(r.fetched_at), ok: !!r.ok, error: r.error }]));
  const stored = await loadStoredState(today);
  let tasks = planTasks(movies, fetched, stored, Date.now(), today);
  if (opts.reasons?.length) tasks = tasks.filter((t) => opts.reasons!.includes(t.reason));

  const maxPages = opts.maxPages ?? Number(process.env.MOVIEMINT_PAGES_PER_RUN ?? 18);
  const delayMs = opts.delayMs ?? Number(process.env.MOVIEMINT_DELAY_MS ?? 1200);
  const touched = new Map<string, { available?: string[]; meta: Record<string, unknown> }>();
  let done = 0;
  let consecutiveErrors = 0;
  for (const t of tasks) {
    if (done >= maxPages) {
      stoppedBy = 'page budget';
      break;
    }
    // keep time for the summaries of the movies touched so far (~0.4 s each),
    // so a run never ends between writing days and summarising them
    if (Date.now() + 6_000 + touched.size * 500 > opts.deadline) {
      stoppedBy = 'time';
      break;
    }
    if (done > 0) await sleep(delayMs);
    done++;
    const m = bySlug.get(t.slug)!;
    try {
      const page = await fetchMoviePage(t);
      page.unknown.forEach((f) => unknownFields.add(f));
      if (page.unknown.length) await recordUnknown(page.unknown, m.moviemintId);
      // A dated box-office report writes that date only; a later-day date
      // must really be after the window.
      const only = t.kind === 'boxoffice' && t.date && t.date !== CUMULATIVE ? t.date : null;
      const w = await writePage(page, m, today, only);
      await recordFetch(t.movieId, t.page, true, null, page.day?.lastUpdated ?? page.series[page.series.length - 1]?.lastUpdated ?? null);
      const prev = touched.get(m.slug) ?? { meta: {} };
      touched.set(m.slug, { available: page.kind === 'boxoffice' && page.series.length ? page.availableDates : prev.available, meta: { ...prev.meta, ...w.meta } });
      pages.push({ page: t.page, movie: t.movieId, ok: true, rows: w.rows, breakdowns: w.breakdowns });
      consecutiveErrors = 0;
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 300);
      const missing = err instanceof MmiDateMismatch;
      pages.push({ page: t.page, movie: t.movieId, ok: false, missing, error: msg });
      if (!missing) errors.push(`${t.movieId} ${t.page}: ${msg}`);
      await recordFetch(t.movieId, t.page, false, missing ? `missing: ${msg}` : msg, null).catch(() => undefined);
      if (err instanceof MovieMintRefused) {
        stoppedBy = 'refused';
        break;
      }
      if (missing) continue; // a missing date is an answer, not an error
      if (err instanceof MmiFormatError && /no movie config/.test(msg)) continue;
      if (++consecutiveErrors >= 3) {
        stoppedBy = 'errors';
        break;
      }
    }
  }

  // 4. Summaries
  let refreshed = 0;
  for (const [slug, info] of touched) {
    try {
      await refreshMovie(bySlug.get(slug)!, today, { availableDates: info.available, meta: info.meta });
      refreshed++;
    } catch (err: any) {
      errors.push(`refresh ${slug}: ${String(err?.message ?? err).slice(0, 200)}`);
    }
  }

  const rest = tasks.slice(done);
  const pendingByReason: Record<string, number> = {};
  for (const t of rest) pendingByReason[t.reason] = (pendingByReason[t.reason] ?? 0) + 1;
  const result: RunResult = {
    startedAt,
    finishedAt: new Date().toISOString(),
    catalog,
    links,
    pages,
    refreshed,
    pending: rest.length,
    pendingByReason,
    unknownFields: [...unknownFields],
    stoppedBy,
    errors
  };
  await saveResult(result);
  return result;
}

async function saveResult(r: RunResult) {
  const now = new Date().toISOString();
  await db.from('bf_sync_state').upsert({ key: 'last_mmi_sync', value: { ...r, pages: r.pages.slice(-40) }, updated_at: now }, { onConflict: 'key' });
  if (r.stoppedBy !== 'catalog' && (!r.errors.length || r.pages.some((p) => p.ok))) {
    await db.from('bf_sync_state').upsert({ key: 'last_mmi_success', value: { finishedAt: r.finishedAt, pages: r.pages.filter((p) => p.ok).length }, updated_at: now }, { onConflict: 'key' });
  }
  const failures = r.pages.filter((p) => !p.ok && !p.missing).map((p) => ({ at: r.finishedAt, movie: p.movie, page: p.page, error: p.error }));
  if (failures.length || r.stoppedBy === 'catalog') {
    const { data } = await db.from('bf_sync_state').select('value').eq('key', 'mmi_failures').maybeSingle();
    const list = [...(r.stoppedBy === 'catalog' ? [{ at: r.finishedAt, movie: null, page: 'catalog', error: r.errors[0] }] : []), ...failures, ...(((data?.value as any)?.list ?? []) as any[])].slice(0, 100);
    await db.from('bf_sync_state').upsert({ key: 'mmi_failures', value: { list }, updated_at: now }, { onConflict: 'key' });
  }
}

// ---------------------------------------------------------------------------
// Dry run (no database writes at all): what the policy would publish
// ---------------------------------------------------------------------------

export type DryRunMovie = {
  moviemintId: string;
  title: string;
  decision: LinkDecision['action'];
  movieId: string | null;
  slug: string | null;
  note: string | null;
  india: { days: number; first: string | null; last: string | null; gross: number; missing: string[]; breakdownToday: boolean } | null;
  error?: string;
};

export async function dryRun(opts: { fetchPages: boolean; delayMs?: number; maxPages?: number; deadline?: number; log?: (s: string) => void }) {
  const { movies: list, fetchedAt } = await fetchTrackedList(20_000);
  const advance = await fetchAdvanceList();
  const sitemapIds = parseSitemapMovieIds(await fetchText('/sitemap.xml', 20_000, 'application/xml'));
  const state = await loadCatalogState();
  const fresh = new Map<string, MovieMintMovie>(list.map((m) => [m.id, m]));
  const onAdv = new Set(advance.map((a) => a.id));
  const onSm = new Set(sitemapIds);
  state.mm = [
    ...list.map((m) => ({ id: m.id, title: m.title, language: m.language, releaseDate: m.releaseDate, badge: m.badge, onList: true, onAdvance: onAdv.has(m.id), onSitemap: onSm.has(m.id), poster: m.poster, lastTrackedDate: m.lastTrackedDate })),
    ...advance.filter((a) => !fresh.has(a.id)).map((a) => ({ id: a.id, title: a.title, language: a.language, releaseDate: a.releaseDate, badge: a.badge, onList: false, onAdvance: true, onSitemap: onSm.has(a.id), poster: a.poster, lastTrackedDate: null })),
    ...state.mm.filter((m) => !fresh.has(m.id) && !onAdv.has(m.id)).map((m) => ({ ...m, onList: false, onAdvance: false, onSitemap: onSm.has(m.id) }))
  ];
  const plan = planCatalog(state);
  const out: DryRunMovie[] = [];
  let n = 0;
  for (const d of plan) {
    const mm = state.mm.find((m) => m.id === d.moviemintId)!;
    const row: DryRunMovie = { moviemintId: d.moviemintId, title: mm.title, decision: d.action, movieId: d.movieId, slug: d.slug, note: d.note, india: null };
    if (opts.fetchPages && d.action !== 'review' && (opts.maxPages == null || n < opts.maxPages) && (!opts.deadline || Date.now() < opts.deadline)) {
      if (n++ > 0) await sleep(opts.delayMs ?? 1500);
      try {
        const upcomingOnly = !mm.onList && mm.onAdvance;
        const page = await fetchMoviePage({ movieId: d.moviemintId, kind: upcomingOnly ? 'advance' : 'boxoffice', date: null, page: upcomingOnly ? 'advance' : 'series' });
        const s = page.series;
        const have = new Set(s.map((p) => p.date));
        const missing: string[] = [];
        if (s.length) for (let x = s[0].date; x < s[s.length - 1].date; x = addDays(x, 1)) if (!have.has(x)) missing.push(x);
        row.india = { days: s.length, first: s[0]?.date ?? null, last: s[s.length - 1]?.date ?? null, gross: Math.round(s.reduce((a, p) => a + p.gross, 0)), missing, breakdownToday: !!page.day && have.has(page.day.date) };
        opts.log?.(`${d.moviemintId}: ${s.length} days, ₹${(row.india.gross / 1e7).toFixed(2)} Cr`);
      } catch (err: any) {
        row.error = String(err?.message ?? err).slice(0, 200);
        opts.log?.(`${d.moviemintId}: ${row.error}`);
        if (err instanceof MovieMintRefused) break;
      }
    }
    out.push(row);
  }
  return { fetchedAt, onList: list.length, onAdvance: advance.length, onSitemap: sitemapIds.length, plan: out };
}
