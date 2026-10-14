// MovieMint India import (catalog link + India figures) -> mmi_* tables.
//
// Pipeline (each scheduled run, see app/api/cron/moviemint/route.ts):
//   1. MovieMint catalog: refresh the stored /tracked list (mm_movie) at
//      most every CATALOG_TTL; if MovieMint is unreachable the run stops
//      here and the site keeps the last good catalog and data.
//   2. Link every MovieMint movie to its canonical Fyre movie (lib/moviemint/
//      india/link.ts): existing Fyre ids and URLs are kept, missing movies are
//      created, uncertain ones go to admin review.
//   3. India figures, paced (a page budget per run, a polite gap between
//      requests, stop at the first refusal):
//        a. running movies' series page (every day's totals + today's live
//           breakdown) when older than SERIES_TTL
//        b. advance page for upcoming / running movies (ADVANCE_TTL)
//        c. series page once for every linked movie never fetched
//        d. per-date pages for final breakdowns, newest first, within the
//           breakdown window (default 90 days)
//   4. mmi_movie summaries for every movie touched.
// Idempotent: every write is an upsert keyed by (slug, kind, date); a re-run
// rewrites the same rows. Nothing is ever deleted; a date MovieMint drops
// from its series is kept and flagged in_source = false.
import axios from 'axios';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { MOVIEMINT_ORIGIN, fetchTrackedList, type MovieMintMovie } from '../catalog';
import { syncMovieMintCatalog } from '../sync';
import { exactKey } from '../match';
import { MmiFormatError, parseAdvanceList, parseMoviePage, type MmiAdvanceListing, type MmiKind, type MmiPage } from './parse';
import { addDays, movieRow, pageRows, type DayRow, type StoredDay, type StoredTotals } from './normalize';
import { planLinks, type FyreEntry, type LinkDecision, type LinkRow, type MmEntry } from './link';
import { MMI_BREAKDOWN_DAYS, planTasks, type LinkedMovie, type PageRequest, type Task } from './plan';

export { MMI_BREAKDOWN_DAYS, type LinkedMovie, type Task };

const db = supabaseAdmin as any;
const USER_AGENT = 'fyre.co.in catalog sync (+https://fyre.co.in)';
const INTERACTIVE_CHALLENGE = /attention required|cf-chl-widget|g-recaptcha|h-captcha|verify you are human/i;

const CATALOG_TTL_MS = Number(process.env.MMI_CATALOG_TTL_MIN ?? 360) * 60_000;

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

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

export class MovieMintRefused extends Error {}


export function pagePath(r: Pick<PageRequest, 'movieId' | 'kind' | 'date'>): string {
  const q = new URLSearchParams();
  if (r.kind === 'advance') q.set('kind', 'advance');
  if (r.date) q.set('date', r.date.replace(/-/g, ''));
  const qs = q.toString();
  return `/movie/${encodeURIComponent(r.movieId)}${qs ? `?${qs}` : ''}`;
}

export const mmiSourceLog: { at: string; path: string; status: number | string; ms: number }[] = [];

export async function fetchMoviePage(r: PageRequest, timeoutMs = 20_000): Promise<MmiPage> {
  const path = pagePath(r);
  const t0 = Date.now();
  let status: number | string = 'error';
  try {
    const res = await axios.get<string>(`${MOVIEMINT_ORIGIN}${path}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      timeout: timeoutMs,
      responseType: 'text',
      maxRedirects: 2,
      validateStatus: () => true
    });
    status = res.status;
    const html = String(res.data ?? '');
    if (res.status === 403 || res.status === 429 || INTERACTIVE_CHALLENGE.test(html)) throw new MovieMintRefused(`MovieMint refused ${path} (HTTP ${res.status}); stopping this run`);
    if (res.status !== 200) throw new Error(`MovieMint ${path} answered HTTP ${res.status}`);
    return parseMoviePage(html, r.movieId, r.kind);
  } finally {
    mmiSourceLog.push({ at: new Date().toISOString(), path, status, ms: Date.now() - t0 });
    if (mmiSourceLog.length > 500) mmiSourceLog.splice(0, mmiSourceLog.length - 500);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Catalog link
// ---------------------------------------------------------------------------

export async function fetchAdvanceList(timeoutMs = 20_000): Promise<MmiAdvanceListing[]> {
  const res = await axios.get<string>(`${MOVIEMINT_ORIGIN}/advance`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    timeout: timeoutMs,
    responseType: 'text',
    validateStatus: () => true
  });
  const html = String(res.data ?? '');
  mmiSourceLog.push({ at: new Date().toISOString(), path: '/advance', status: res.status, ms: 0 });
  if (res.status === 403 || res.status === 429 || INTERACTIVE_CHALLENGE.test(html)) throw new MovieMintRefused(`MovieMint refused /advance (HTTP ${res.status})`);
  if (res.status !== 200) throw new Error(`MovieMint /advance answered HTTP ${res.status}`);
  return parseAdvanceList(html);
}

// Both MovieMint lists: /tracked (released films; the existing mm_movie
// refresh, lib/moviemint/sync.ts) and /advance (advance sales open,
// including releases not on /tracked yet). An empty /advance list is
// legitimate (no upcoming releases), but a failed request is not "empty":
// it leaves the stored flags as they were.
export async function syncCatalogLists(): Promise<{ tracked: unknown; advance: number }> {
  const tracked = await syncMovieMintCatalog({ timeoutMs: 15_000 });
  const listing = await fetchAdvanceList();
  const now = new Date().toISOString();
  const { data: known } = await db.from('mm_movie').select('moviemint_id,on_advance');
  const have = new Set((known ?? []).map((r: any) => r.moviemint_id));
  const fresh = listing.filter((a) => !have.has(a.id));
  if (fresh.length) {
    await must(
      db.from('mm_movie').upsert(
        fresh.map((a) => ({
          moviemint_id: a.id,
          title: a.title,
          language: a.language,
          release_date: a.releaseDate,
          poster: a.poster,
          badge: a.badge,
          source_url: `${MOVIEMINT_ORIGIN}/movie/${a.id}`,
          on_list: false,
          last_seen: now,
          updated_at: now
        })),
        { onConflict: 'moviemint_id' }
      ),
      'mm_movie advance'
    );
  }
  const ids = listing.map((a) => a.id);
  if (ids.length) await must(db.from('mm_movie').update({ on_advance: true, advance_seen_at: now }).in('moviemint_id', ids), 'mm_movie on_advance');
  const gone = (known ?? []).filter((r: any) => r.on_advance && !ids.includes(r.moviemint_id)).map((r: any) => r.moviemint_id);
  if (gone.length) await must(db.from('mm_movie').update({ on_advance: false }).in('moviemint_id', gone), 'mm_movie off advance');
  return { tracked, advance: listing.length };
}

export type CatalogState = {
  mm: (MmEntry & { onList: boolean; onAdvance: boolean; poster: string | null; lastTrackedDate: string | null })[];
  fyre: (FyreEntry & { trackingStatus: string; metadata: any })[];
  links: LinkRow[];
  takenSlugs: Set<string>;
};

export async function loadCatalogState(): Promise<CatalogState> {
  const [mmRows, fyreRows, aliasRows, linkRows] = await Promise.all([
    selectAll('mm_movie', 'moviemint_id,title,language,release_date,poster,badge,on_list,on_advance,last_tracked_date').catch((err) => {
      // before supabase/migration_moviemint_india.sql (dry run): no on_advance yet
      if (!/on_advance/.test(String(err?.message))) throw err;
      return selectAll('mm_movie', 'moviemint_id,title,language,release_date,poster,badge,on_list,last_tracked_date');
    }),
    selectAll('fyre_tracked_movie', 'moviemint_id,bf_slug,title,origin,release_date,first_source_date,languages,tracking_status,match_status,metadata'),
    selectAll('fyre_movie_alias', 'movie_id,source_title,decision', (q) => q.in('decision', ['created', 'matched'])),
    // [] before supabase/migration_moviemint_india.sql (dry run)
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
      {
        moviemint_id: d.moviemintId,
        movie_id: d.movieId,
        slug: d.slug,
        link_status: status,
        link_method: d.method === 'kept' ? null : d.method,
        link_note: d.note,
        candidates: d.candidates,
        updated_at: now
      },
      { onConflict: 'moviemint_id' }
    );
    if (error) throw new Error(`mmi_catalog ${d.moviemintId}: ${error.message}`);
    if (status === 'linked' && d.movieId) {
      linked++;
      // Record the MovieMint title as a confirmed title of the Fyre movie
      // (once): USA matching uses it as a spelling variant.
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
        lastTrackedDate: m.lastTrackedDate,
        stopped: f?.trackingStatus === 'stopped'
      };
    });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

async function storedDays(slug: string): Promise<Map<string, { totals: Partial<StoredTotals>; status: string; inSource: boolean }>> {
  const rows = await selectAll('mmi_movie_day', 'kind,date,totals,breakdown_status,in_source', (q) => q.eq('slug', slug));
  return new Map(rows.map((r) => [`${r.kind}:${r.date}`, { totals: r.totals ?? {}, status: r.breakdown_status, inSource: r.in_source }]));
}

// onlyDate: a per-date page -- write that date only (its series copy is
// refreshed by the series page itself).
export async function writePage(page: MmiPage, m: LinkedMovie, today: string, onlyDate: string | null = null): Promise<{ rows: number; breakdowns: number; dropped: number }> {
  const now = new Date().toISOString();
  const have = await storedDays(m.slug);
  const totalsBy = new Map([...have.entries()].map(([k, v]) => [k, v.totals]));
  const rows = pageRows(page, { slug: m.slug, moviemintId: m.moviemintId, title: m.title, now, today }, totalsBy).filter((r) => !onlyDate || r.date === onlyDate);
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
  // Dates MovieMint's series no longer lists: kept, flagged.
  let dropped = 0;
  if (page.kind === 'boxoffice' && page.series.length && !onlyDate) {
    const inSeries = new Set(page.series.map((p) => p.date));
    const gone = [...have.entries()].filter(([k, v]) => k.startsWith('boxoffice:') && v.inSource && !inSeries.has(k.slice(10))).map(([k]) => k.slice(10));
    if (gone.length) {
      await must(db.from('mmi_movie_day').update({ in_source: false }).eq('slug', m.slug).eq('kind', 'boxoffice').in('date', gone), 'mmi_movie_day in_source');
      dropped = gone.length;
    }
    const back = page.series.filter((p) => have.get(`boxoffice:${p.date}`)?.inSource === false).map((p) => p.date);
    if (back.length) await must(db.from('mmi_movie_day').update({ in_source: true }).eq('slug', m.slug).eq('kind', 'boxoffice').in('date', back), 'mmi_movie_day in_source');
  }
  return { rows: rows.length, breakdowns: withBd.length, dropped };
}

export async function refreshMovie(m: LinkedMovie, today: string, availableDates?: string[]): Promise<void> {
  // Only the language/format lists of each breakdown are needed (ranking);
  // the city lists are never pulled here.
  const rows = await selectAll('mmi_movie_day', 'kind,date,totals,breakdown_status,source_updated,synced_at,langs:breakdown->languages,fmts:breakdown->formats', (q) =>
    q.eq('slug', m.slug).eq('in_source', true)
  );
  const days: StoredDay[] = rows.map((r) => ({
    kind: r.kind,
    date: r.date,
    totals: r.totals ?? {},
    breakdown: { languages: r.langs ?? [], formats: r.fmts ?? [] },
    breakdown_status: r.breakdown_status,
    source_updated: r.source_updated,
    synced_at: r.synced_at
  }));
  let available = availableDates;
  if (!available) {
    const { data } = await db.from('mmi_movie').select('available_dates').eq('slug', m.slug).maybeSingle();
    available = (data?.available_dates ?? []) as string[];
  }
  if (!days.length) return;
  const row = movieRow(
    { slug: m.slug, moviemintId: m.moviemintId, title: m.title, poster: m.poster, language: m.language, releaseDate: m.releaseDate, availableDates: available },
    days,
    today
  );
  await must(db.from('mmi_movie').upsert(row, { onConflict: 'slug' }), 'mmi_movie');
}

async function recordFetch(movieId: string, page: string, ok: boolean, error: string | null, sourceUpdated: string | null) {
  await db.from('mmi_fetch').upsert({ moviemint_id: movieId, page, fetched_at: new Date().toISOString(), ok, error, source_updated: sourceUpdated }, { onConflict: 'moviemint_id,page' });
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
  pages: { page: string; movie: string; ok: boolean; rows?: number; breakdowns?: number; error?: string }[];
  refreshed: number;
  pending: number;
  stoppedBy: string | null;
  errors: string[];
};

export async function runMovieMintIndia(opts: RunOptions): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const pages: RunResult['pages'] = [];
  const today = istToday();
  let stoppedBy: string | null = null;

  // 1. Catalog (failure = stop; nothing below runs, nothing is cleared)
  let catalog: unknown = null;
  try {
    const { data } = await db.from('bf_sync_state').select('value').eq('key', 'last_moviemint_sync').maybeSingle();
    const last = Date.parse((data?.value as any)?.fetchedAt ?? '') || 0;
    if (opts.forceCatalog || Date.now() - last > CATALOG_TTL_MS) catalog = await syncCatalogLists();
    else catalog = { skipped: 'fresh', fetchedAt: (data?.value as any)?.fetchedAt };
  } catch (err: any) {
    const msg = `catalog: MovieMint unavailable (${String(err?.message ?? err).slice(0, 200)}); kept the last good catalog and data`;
    const result: RunResult = { startedAt, finishedAt: new Date().toISOString(), catalog: null, links: null, pages, refreshed: 0, pending: 0, stoppedBy: 'catalog', errors: [msg] };
    await saveResult(result);
    return result;
  }

  // 2. Link
  const state = await loadCatalogState();
  const plan = planCatalog(state);
  const links = await applyCatalogPlan(state, plan);

  // 3. India pages
  let movies = await loadLinkedMovies(state);
  if (opts.only?.length) movies = movies.filter((m) => opts.only!.includes(m.moviemintId));
  const bySlug = new Map(movies.map((m) => [m.slug, m]));
  const fetchRows = await selectAll('mmi_fetch', 'moviemint_id,page,fetched_at,ok');
  const fetched = new Map(fetchRows.map((r) => [`${r.moviemint_id}|${r.page}`, { at: Date.parse(r.fetched_at), ok: !!r.ok }]));
  const movieRows = await selectAll('mmi_movie', 'slug,available_dates,last_date');
  const finalRows = await selectAll('mmi_movie_day', 'slug,date', (q) => q.eq('kind', 'boxoffice').eq('breakdown_status', 'final').gte('date', addDays(today, -MMI_BREAKDOWN_DAYS)));
  const finals = new Map<string, Set<string>>();
  for (const r of finalRows) finals.set(r.slug, (finals.get(r.slug) ?? new Set()).add(r.date));
  const stored = new Map(movieRows.map((r) => [r.slug, { availableDates: (r.available_dates ?? []) as string[], finalDates: finals.get(r.slug) ?? new Set<string>(), lastDate: r.last_date }]));
  let tasks = planTasks(movies, fetched, stored, Date.now(), today);
  if (opts.reasons?.length) tasks = tasks.filter((t) => opts.reasons!.includes(t.reason));

  const maxPages = opts.maxPages ?? Number(process.env.MOVIEMINT_PAGES_PER_RUN ?? 18);
  const delayMs = opts.delayMs ?? Number(process.env.MOVIEMINT_DELAY_MS ?? 1200);
  const touched = new Map<string, string[] | undefined>();
  let done = 0;
  let consecutiveErrors = 0;
  for (const t of tasks) {
    if (done >= maxPages) {
      stoppedBy = 'page budget';
      break;
    }
    if (Date.now() + 6_000 > opts.deadline) {
      stoppedBy = 'time';
      break;
    }
    if (done > 0) await sleep(delayMs);
    done++;
    const m = bySlug.get(t.slug)!;
    try {
      const page = await fetchMoviePage(t);
      const w = await writePage(page, m, today, t.kind === 'boxoffice' ? t.date : null);
      await recordFetch(t.movieId, t.page, true, null, page.day?.lastUpdated ?? page.series[page.series.length - 1]?.lastUpdated ?? null);
      if (page.kind === 'boxoffice') touched.set(m.slug, page.availableDates);
      else if (!touched.has(m.slug)) touched.set(m.slug, undefined);
      pages.push({ page: t.page, movie: t.movieId, ok: true, rows: w.rows, breakdowns: w.breakdowns });
      consecutiveErrors = 0;
    } catch (err: any) {
      const msg = String(err?.message ?? err).slice(0, 300);
      pages.push({ page: t.page, movie: t.movieId, ok: false, error: msg });
      errors.push(`${t.movieId} ${t.page}: ${msg}`);
      await recordFetch(t.movieId, t.page, false, msg, null).catch(() => undefined);
      if (err instanceof MovieMintRefused) {
        stoppedBy = 'refused';
        break;
      }
      if (err instanceof MmiFormatError && /no movie config/.test(msg)) {
        // page gone or layout changed for this movie only -- continue
      }
      if (++consecutiveErrors >= 3) {
        stoppedBy = 'errors';
        break;
      }
    }
  }

  // 4. Summaries
  let refreshed = 0;
  for (const [slug, available] of touched) {
    try {
      await refreshMovie(bySlug.get(slug)!, today, available);
      refreshed++;
    } catch (err: any) {
      errors.push(`refresh ${slug}: ${String(err?.message ?? err).slice(0, 200)}`);
    }
  }

  const result: RunResult = {
    startedAt,
    finishedAt: new Date().toISOString(),
    catalog,
    links,
    pages,
    refreshed,
    pending: Math.max(0, tasks.length - done),
    stoppedBy,
    errors
  };
  await saveResult(result);
  return result;
}

async function saveResult(r: RunResult) {
  const now = new Date().toISOString();
  await db.from('bf_sync_state').upsert({ key: 'last_mmi_sync', value: { ...r, pages: r.pages.slice(-40) }, updated_at: now }, { onConflict: 'key' });
  if (!r.errors.length || r.pages.some((p) => p.ok)) {
    await db.from('bf_sync_state').upsert({ key: 'last_mmi_success', value: { finishedAt: r.finishedAt, pages: r.pages.filter((p) => p.ok).length }, updated_at: now }, { onConflict: 'key' });
  }
  const failures = r.pages.filter((p) => !p.ok).map((p) => ({ at: r.finishedAt, movie: p.movie, page: p.page, error: p.error }));
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
  const state = await loadCatalogState();
  // Overlay the freshly fetched lists (what a run would store) without writing them.
  const fresh = new Map<string, MovieMintMovie>(list.map((m) => [m.id, m]));
  const onAdv = new Set(advance.map((a) => a.id));
  state.mm = [
    ...list.map((m) => ({ id: m.id, title: m.title, language: m.language, releaseDate: m.releaseDate, badge: m.badge, onList: true, onAdvance: onAdv.has(m.id), poster: m.poster, lastTrackedDate: m.lastTrackedDate })),
    ...advance.filter((a) => !fresh.has(a.id)).map((a) => ({ id: a.id, title: a.title, language: a.language, releaseDate: a.releaseDate, badge: a.badge, onList: false, onAdvance: true, poster: a.poster, lastTrackedDate: null })),
    ...state.mm.filter((m) => !fresh.has(m.id) && !onAdv.has(m.id)).map((m) => ({ ...m, onList: false, onAdvance: false }))
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
        row.india = {
          days: s.length,
          first: s[0]?.date ?? null,
          last: s[s.length - 1]?.date ?? null,
          gross: Math.round(s.reduce((a, p) => a + p.gross, 0)),
          missing,
          breakdownToday: !!page.day && have.has(page.day.date)
        };
        opts.log?.(`${d.moviemintId}: ${s.length} days, ₹${(row.india.gross / 1e7).toFixed(2)} Cr`);
      } catch (err: any) {
        row.error = String(err?.message ?? err).slice(0, 200);
        opts.log?.(`${d.moviemintId}: ${row.error}`);
        if (err instanceof MovieMintRefused) break;
      }
    }
    out.push(row);
  }
  return { fetchedAt, onList: list.length, onAdvance: advance.length, plan: out };
}
