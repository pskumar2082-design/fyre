// One-time 90-day catalog bootstrap: BFILMY-first discovery over the last
// ACTIVE_WINDOW_DAYS of source files, never older (no 2023/2024/2025 crawl).
//
//   India: each date's summary file(s) are fetched ONCE, oldest first; every
//          title in the file is discovered (attach / create / review /
//          wait, lib/catalog/listings) and the figures of the movies that
//          need history (newly created, or history requested) are imported
//          from that same copy. A movie whose last activity is before the
//          window never appears in these files, so it is never discovered.
//   USA:   the same over the USA date files, for movies with no USA data
//          yet plus any discovered from those files.
//   finish: history ranges are recorded (history_complete = false when the
//          window cut a run short -> "tracked period", never "lifetime");
//          show-level breakdowns are left to the regular history importer
//          (one fetch per file, existing retention).
//
// Resumable: state in bf_sync_state 'catalog_bootstrap'; each run continues
// where the last stopped. Started explicitly (scripts/catalog-bootstrap.ts or
// the cron's ?bootstrap=start); existing movies, ids and URLs never change.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { istDate, syncBfilmy } from '@/lib/bfilmy/sync';
import { trackedKeys } from '@/lib/tracking';
import { loadTrackedMovies, recordUsHistory, refreshReleaseDays, syncUsFile } from '@/lib/usa/sync';
import { historyRange, NOTE, windowStart } from './core';
import { getBootstrap, saveBootstrap, type BootstrapState } from './bootstrapState';

const db = supabaseAdmin as any;
export const BOOTSTRAP_MAX = Number(process.env.CATALOG_BOOTSTRAP_MAX ?? 400);

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

// Pure: the date files the bootstrap reads -- one per date and feed inside
// the window, never per movie.
export function bootstrapPlan(floor: string, end: string, feeds: string[]): { date: string; kind: string }[] {
  const out: { date: string; kind: string }[] = [];
  for (let d = floor; d <= end; d = addDays(d, 1)) for (const kind of feeds) out.push({ date: d, kind });
  return out;
}

// Movies whose India history the bootstrap imports: history requested, or
// a Fyre-created movie whose history is not complete yet (e.g. created
// before the bootstrap and only partly imported since).
async function requestedIndia(): Promise<{ moviemint_id: string; bf_slug: string; release_date: string | null }[]> {
  const { data, error } = await db
    .from('fyre_tracked_movie')
    .select('moviemint_id,bf_slug,release_date')
    .eq('match_status', 'matched')
    .not('bf_slug', 'is', null)
    .neq('tracking_status', 'stopped')
    .or('backfill_status.in.(requested,running),and(history_complete.eq.false,origin.neq.moviemint)');
  if (error) throw new Error(`fyre_tracked_movie: ${error.message}`);
  return data ?? [];
}

export type BootstrapRun = { phase: string; dates: string[]; created: number; fetched: { india: number; usa: number }; errors: string[]; stopped?: string; stats?: BootstrapStats };

// maxDates / maxCreate: a small controlled run (at most this many dates /
// new movies this run). resume: continue after a cap pause.
// fromCron: the scheduled job continues only a bootstrap started for it
// (?bootstrap=start); one started from the script for a controlled run is
// left alone until the script (or --auto) continues it.
export type BootstrapOptions = { start?: boolean; feeds?: ('boxoffice' | 'advance')[]; maxDates?: number; maxCreate?: number; resume?: boolean; fromCron?: boolean; auto?: boolean };

// ---------------------------------------------------------------------------
// Statistics (from what is stored -- every listing seen inside the window)
// ---------------------------------------------------------------------------
export type BootstrapStats = {
  window: string;
  titlesEncountered: { india: number; usa: number; total: number }; // per file, summed
  uniqueListings: { india: number; usa: number; total: number }; // distinct India title keys / USA ids
  existingFyreMatches: number; // listings attached to movies that already existed
  newFyreMovies: number; // canonical movies created by the bootstrap
  newMovieListings: number; // listings belonging to those new movies
  adminReview: number; // listings waiting for an admin decision
  duplicateConflict: number; // ... of which: same / similar / related title, split listing, language conflict
  advanceOnly: number; // candidates seen only in advance files so far
  filteredJunk: number; // junk / event / ride / combo titles
  previouslyRejected: number;
  deferredByCap: number; // would be created, held back by the cap (kept as candidates)
  waitingNoShows: number; // box office row without a real show record
  otherUnmatched: number;
  newMoviesByTerritory: { indiaOnly: number; usaOnly: number; indiaAndUsa: number };
};

const DUP = /same title|similar title|related title|more than one|split listing|already matched|different languages/i;

async function pages(build: (from: number, to: number) => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Pure: classify the listings seen inside the window.
export function classifyListings(india: any[], usa: any[], newIds: Set<string>): Omit<BootstrapStats, 'window' | 'titlesEncountered'> {
  const st = {
    uniqueListings: { india: india.length, usa: usa.length, total: india.length + usa.length },
    existingFyreMatches: 0,
    newFyreMovies: newIds.size,
    newMovieListings: 0,
    adminReview: 0,
    duplicateConflict: 0,
    advanceOnly: 0,
    filteredJunk: 0,
    previouslyRejected: 0,
    deferredByCap: 0,
    waitingNoShows: 0,
    otherUnmatched: 0,
    newMoviesByTerritory: { indiaOnly: 0, usaOnly: 0, indiaAndUsa: 0 }
  };
  const inIndia = new Set<string>();
  const inUsa = new Set<string>();
  for (const [rows, territory] of [
    [india, inIndia],
    [usa, inUsa]
  ] as const) {
    for (const r of rows) {
      const note = String(r.match_note ?? '');
      if (r.match_status === 'matched' && r.movie_id) {
        territory.add(r.movie_id);
        if (newIds.has(r.movie_id)) st.newMovieListings++;
        else st.existingFyreMatches++;
      } else if (r.match_status === 'rejected') st.previouslyRejected++;
      else if (r.match_status === 'needs_review') {
        st.adminReview++;
        if (DUP.test(note)) st.duplicateConflict++;
      } else if (note.startsWith(NOTE.advanceOnly)) st.advanceOnly++;
      else if (note.startsWith(NOTE.filtered)) st.filteredJunk++;
      else if (note.startsWith(NOTE.deferred)) st.deferredByCap++;
      else if (note.startsWith(NOTE.noShows)) st.waitingNoShows++;
      else st.otherUnmatched++;
    }
  }
  for (const id of newIds) {
    const i = inIndia.has(id);
    const u = inUsa.has(id);
    if (i && u) st.newMoviesByTerritory.indiaAndUsa++;
    else if (u) st.newMoviesByTerritory.usaOnly++;
    else st.newMoviesByTerritory.indiaOnly++;
  }
  return st;
}

export async function bootstrapStats(s: BootstrapState): Promise<BootstrapStats> {
  const [india, usa] = await Promise.all([
    pages((f, t) => db.from('bf_listing').select('key,movie_id,match_status,match_note').gte('last_date', s.floor).range(f, t)),
    pages((f, t) => db.from('us_movie_map').select('source_movie_id,movie_id,match_status,match_note').gte('last_date', s.floor).range(f, t))
  ]);
  const newIds = new Set<string>(s.createdUsa);
  if (s.createdSlugs.length) {
    for (let i = 0; i < s.createdSlugs.length; i += 100) {
      const part = s.createdSlugs.slice(i, i + 100);
      const rows = await pages((f, t) => db.from('fyre_tracked_movie').select('moviemint_id').in('bf_slug', part).range(f, t));
      for (const r of rows) newIds.add(r.moviemint_id);
    }
  }
  return {
    window: `${s.floor} .. ${s.end}`,
    titlesEncountered: { india: s.titles?.india ?? 0, usa: s.titles?.usa ?? 0, total: (s.titles?.india ?? 0) + (s.titles?.usa ?? 0) },
    ...classifyListings(india, usa, newIds)
  };
}

// One runner at a time (the cron and the local script may overlap).
const LOCK_KEY = 'catalog_bootstrap_lock';
async function takeLock(until: number): Promise<boolean> {
  const { data } = await db.from('bf_sync_state').select('value').eq('key', LOCK_KEY).maybeSingle();
  if (Number(data?.value?.until ?? 0) > Date.now()) return false;
  await db.from('bf_sync_state').upsert({ key: LOCK_KEY, value: { until }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return true;
}
async function dropLock() {
  await db.from('bf_sync_state').upsert({ key: LOCK_KEY, value: { until: 0 }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

export async function runCatalogBootstrap(deadline: number, opts: BootstrapOptions = {}): Promise<BootstrapRun | null> {
  const existing = await getBootstrap();
  if (!existing && !opts.start) return null;
  if (existing && opts.fromCron && !existing.auto && existing.phase !== 'done') return null;
  if (existing?.phase === 'done') return { phase: 'done', dates: [], created: 0, fetched: { india: 0, usa: 0 }, errors: [], stats: await bootstrapStats(existing) };
  if (!(await takeLock(deadline + 120_000))) return { phase: existing?.phase ?? 'india', dates: [], created: 0, fetched: { india: 0, usa: 0 }, errors: ['another bootstrap run is in progress'] };
  try {
    return await step(deadline, existing, opts);
  } finally {
    await dropLock();
  }
}

async function step(deadline: number, existing: BootstrapState | null, opts: BootstrapOptions): Promise<BootstrapRun> {
  let state = existing;
  if (!state) {
    const today = istDate(0);
    state = {
      phase: 'india',
      floor: windowStart(today),
      end: istDate(-1),
      next: windowStart(today),
      feeds: opts.feeds ?? ['boxoffice', 'advance'],
      createdSlugs: [],
      createdUsa: [],
      usaImport: [],
      fetched: { india: 0, usa: 0 },
      startedAt: new Date().toISOString(),
      auto: !!opts.fromCron || !!opts.auto
    };
    await saveBootstrap(state);
  } else if (opts.auto && !state.auto) {
    state.auto = true;
    await saveBootstrap(state);
  }
  const s: BootstrapState = state;
  const run: BootstrapRun = { phase: s.phase, dates: [], created: 0, fetched: { india: 0, usa: 0 }, errors: [] };
  if (s.phase === 'done') return run;
  s.titles ??= { india: 0, usa: 0 };
  const globalLeft = () => Math.max(0, BOOTSTRAP_MAX - s.createdSlugs.length - s.createdUsa.length);
  // Cap pause: stays stopped until resumed with room under the cap.
  if (s.paused) {
    if (!opts.resume || globalLeft() === 0) {
      run.stopped = `paused: ${s.paused.reason} (at ${s.paused.at})${globalLeft() === 0 ? ` -- raise CATALOG_BOOTSTRAP_MAX above ${BOOTSTRAP_MAX} and resume` : ' -- resume to continue'}`;
      run.stats = await bootstrapStats(s);
      return run;
    }
    s.paused = null;
    await saveBootstrap(s);
  }
  const budget = { left: Math.min(globalLeft(), opts.maxCreate ?? Number.POSITIVE_INFINITY) };
  const maxDates = opts.maxDates ?? Number.POSITIVE_INFINITY;
  // After each date: stop safely once no creation is left (never exceeds
  // the cap; the remaining listings stay as candidates and are reported).
  const capCheck = async (date: string): Promise<boolean> => {
    if (budget.left > 0) return false;
    if (globalLeft() === 0) {
      s.paused = { reason: `CATALOG_BOOTSTRAP_MAX (${BOOTSTRAP_MAX}) new movies reached`, at: date };
      await saveBootstrap(s);
      run.stopped = `paused at the ${BOOTSTRAP_MAX}-movie cap after ${date}`;
    } else run.stopped = `this run's creation limit (${opts.maxCreate}) reached after ${date}`;
    return true;
  };

  // India
  while (s.phase === 'india' && Date.now() < deadline && !run.stopped) {
    if (run.dates.length >= maxDates) {
      run.stopped = `this run's date limit (${opts.maxDates}) reached`;
      break;
    }
    if (s.next > s.end) {
      const { data: mapped } = await db.from('us_movie_map').select('movie_id').eq('match_status', 'matched').neq('backfill_status', 'requested');
      const hasUsa = new Set((mapped ?? []).map((r: any) => r.movie_id));
      const { data: all } = await db.from('fyre_tracked_movie').select('moviemint_id').eq('match_status', 'matched');
      s.usaImport = (all ?? []).map((r: any) => r.moviemint_id).filter((id: string) => !hasUsa.has(id));
      s.phase = 'usa';
      s.next = s.floor;
      await saveBootstrap(s);
      break;
    }
    const date = s.next;
    const catalog = await trackedKeys(db);
    const pending = await requestedIndia();
    const importSlugs = [...new Set([...pending.map((p) => p.bf_slug), ...s.createdSlugs])];
    const importKeys = importSlugs.length ? (await trackedKeys(db, importSlugs)).keys : new Set<string>();
    s.joined ??= {};
    for (const slug of importSlugs) s.joined[slug] ??= date;
    const targets = s.feeds.map((kind) => ({ kind, date }));
    const r = await syncBfilmy(targets, { tracked: catalog.keys, listings: true, importKeys, budget, posters: false, prune: false, recordState: false });
    for (const c of r.listings?.created ?? []) {
      const slug = /\(([^)]+)\)\s*$/.exec(c)?.[1];
      if (slug) {
        s.createdSlugs.push(slug);
        s.joined![slug] ??= date;
      }
      run.created++;
    }
    run.errors.push(...r.errors);
    s.titles.india += r.listings?.titles ?? 0;
    s.fetched.india += targets.length;
    run.fetched.india += targets.length;
    run.dates.push(`india ${date}`);
    s.next = addDays(date, 1);
    await saveBootstrap(s);
    if (await capCheck(date)) break;
  }

  // USA
  let movies: Awaited<ReturnType<typeof loadTrackedMovies>> | null = null;
  while (s.phase === 'usa' && Date.now() < deadline && !run.stopped) {
    if (run.dates.length >= maxDates) {
      run.stopped = `this run's date limit (${opts.maxDates}) reached`;
      break;
    }
    if (s.next > s.end) {
      s.phase = 'finish';
      await saveBootstrap(s);
      break;
    }
    const date = s.next;
    movies ??= await loadTrackedMovies();
    const only = new Set<string>([...s.usaImport, ...s.createdUsa]);
    for (const kind of s.feeds) {
      const res = await syncUsFile(kind, date, { movies, discover: budget, onlyMovieIds: only, includeEnded: true, skipReleaseDays: true });
      if (res.status === 'error') run.errors.push(`usa ${kind} ${date}: ${res.error}`);
      s.fetched.usa += res.requests ?? 1;
      s.titles.usa += res.listings ?? 0;
      run.fetched.usa += res.requests ?? 1;
    }
    for (const id of only) if (!s.usaImport.includes(id) && !s.createdUsa.includes(id)) {
      s.createdUsa.push(id);
      run.created++;
    }
    run.dates.push(`usa ${date}`);
    s.next = addDays(date, 1);
    await saveBootstrap(s);
    if (await capCheck(date)) break;
  }

  // Finish: record history ranges; breakdowns go to the regular importer.
  if (s.phase === 'finish' && Date.now() < deadline && !run.stopped) {
    const today = istDate(0);
    const created = new Set(s.createdSlugs);
    for (const p of await requestedIndia()) {
      const range = historyRange(today, p.release_date);
      // The bootstrap imported from s.floor; a start inside the window after
      // that is a known release date (not clamped).
      const start = range.clamped || range.start < s.floor ? s.floor : range.start;
      const clamped = start === s.floor;
      // Created by the bootstrap: imported from every file since it first
      // qualified -> breakdowns only. Requested by someone else while the
      // bootstrap was already past some dates: those dates still to import
      // (batched, one fetch per file, by the regular history importer).
      const joined = s.joined?.[p.bf_slug] ?? null;
      const gap = !created.has(p.bf_slug) && (!joined || joined > start);
      const value = gap
        ? { phase: 'summary', next: start, from: start, until: joined ? addDays(joined, -1) : null, slug: p.bf_slug, clamped }
        : { phase: 'detail', next: null, from: start, until: null, slug: p.bf_slug, clamped };
      await db.from('bf_sync_state').upsert({ key: `backfill:${p.moviemint_id}`, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      // the regular importer finishes it (breakdowns) and records its history
      await db.from('fyre_tracked_movie').update({ backfill_status: 'requested' }).eq('moviemint_id', p.moviemint_id);
    }
    const usaIds = [...new Set([...s.usaImport, ...s.createdUsa])];
    const { data: maps } = await db.from('us_movie_map').select('source_movie_id,movie_id,first_date').eq('match_status', 'matched').in('movie_id', usaIds.length ? usaIds : ['-']);
    const withUsa = new Set<string>();
    for (const m of maps ?? []) {
      await db.from('us_movie_map').update({ backfill_status: 'done', backfill_next: null }).eq('source_movie_id', m.source_movie_id);
      withUsa.add(m.movie_id);
    }
    for (const id of withUsa) await recordUsHistory(id, { start: s.floor, clamped: true });
    if (withUsa.size) await refreshReleaseDays([...withUsa]).catch((e: any) => run.errors.push(`usa release days: ${e?.message ?? e}`));
    s.phase = 'done';
    s.finishedAt = new Date().toISOString();
    await saveBootstrap(s);
  }
  run.phase = s.phase;
  run.stats = await bootstrapStats(s).catch((e: any) => {
    run.errors.push(`stats: ${e?.message ?? e}`);
    return undefined;
  });
  return run;
}
