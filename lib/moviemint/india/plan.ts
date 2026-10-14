// Which MovieMint pages to fetch next. Pure (no I/O), unit-tested.
//
// Priorities (a run takes tasks in this order until its page budget ends):
//   1. series_active   running films' live view (day series + today's live
//                      report), every SERIES_TTL
//   2. advance         each film with advance sales open: its default show
//                      date and every other open show date, every ADVANCE_TTL
//   3. series_first    every linked film never fetched (incl. sitemap-only),
//                      or fetched but never summarised
//   4. cumulative      the "Cumulative - All Days" report: once for finished
//                      films, twice a day while running
//   5. date_final      the final report of every tracked-window date since
//                      MovieMint's archive start, newest first
//   6. later_probe     dates MovieMint captured after the window, newest
//                      first; a date that comes back as another date is
//                      recorded missing and not asked again for a week
import type { MmiKind } from './parse';
import { addDays } from './normalize';

export const MMI_ARCHIVE_START = process.env.MMI_ARCHIVE_START ?? '2026-06-01';
// No breakdown window any more: every date since the archive start.
export const MMI_BREAKDOWN_DAYS = Number(process.env.MMI_BREAKDOWN_DAYS ?? 3650);
const SERIES_TTL_MS = Number(process.env.MMI_SERIES_TTL_MIN ?? 110) * 60_000;
const ADVANCE_TTL_MS = Number(process.env.MMI_ADVANCE_TTL_MIN ?? 170) * 60_000; // upcoming releases
const RUNNING_ADVANCE_TTL_MS = Number(process.env.MMI_RUNNING_ADVANCE_TTL_MIN ?? 360) * 60_000; // next-day bookings of running films
const CUMULATIVE_TTL_MS = Number(process.env.MMI_CUMULATIVE_TTL_MIN ?? 720) * 60_000;
const RETRY_FAILED_MS = 6 * 3600_000;
const MISSING_RETRY_MS = 7 * 24 * 3600_000;

export type PageRequest = { movieId: string; kind: MmiKind; date: string | null; page: string };

export type LinkedMovie = {
  moviemintId: string;
  movieId: string;
  slug: string;
  title: string;
  poster: string | null;
  language: string | null;
  releaseDate: string | null;
  onList: boolean; // on MovieMint's /tracked list
  onAdvance: boolean; // on MovieMint's /advance list (advance sales open)
  onSitemap?: boolean; // has a MovieMint page (sitemap)
  lastTrackedDate: string | null;
  stopped: boolean;
};

export type StoredState = {
  availableDates: string[]; // tracked-window dates
  finalDates: Set<string>; // window dates with a final breakdown
  laterFinal: Set<string>; // later-day dates stored final
  windowEnd: string | null;
  latestSnapshot: string | null; // newest date MovieMint has a report for (from the live view)
  advanceDates: string[]; // open show dates (from the last advance page)
  lastDate: string | null;
};

export type TaskReason = 'series_active' | 'advance' | 'series_first' | 'cumulative' | 'date_final' | 'later_probe';
export type Task = PageRequest & { slug: string; reason: TaskReason };

export type Fetched = Map<string, { at: number; ok: boolean; error?: string | null }>;

export function planTasks(movies: LinkedMovie[], fetched: Fetched, stored: Map<string, StoredState>, now: number, today: string, breakdownDays = MMI_BREAKDOWN_DAYS): Task[] {
  const key = (id: string, page: string) => `${id}|${page}`;
  const age = (id: string, page: string) => {
    const f = fetched.get(key(id, page));
    return f ? now - f.at : Infinity;
  };
  const failedRecently = (id: string, page: string) => {
    const f = fetched.get(key(id, page));
    if (!f || f.ok) return false;
    const missing = /returned|not found|missing/i.test(f.error ?? '');
    return now - f.at < (missing ? MISSING_RETRY_MS : RETRY_FAILED_MS);
  };
  const live = movies.filter((m) => !m.stopped);
  const running = (m: LinkedMovie) =>
    (m.onList || m.onAdvance) &&
    ((m.lastTrackedDate != null && m.lastTrackedDate >= addDays(today, -3)) || (m.releaseDate != null && m.releaseDate >= addDays(today, -7) && m.releaseDate <= today));
  const stillCaptured = (m: LinkedMovie) => {
    const s = stored.get(m.slug);
    return !!s?.latestSnapshot && s.latestSnapshot >= addDays(today, -2);
  };
  const upcoming = (m: LinkedMovie) => (m.onList || m.onAdvance) && m.releaseDate != null && m.releaseDate > today;
  const t = (m: LinkedMovie, kind: MmiKind, date: string | null, page: string, reason: TaskReason): Task => ({ movieId: m.moviemintId, slug: m.slug, kind, date, page, reason });

  const seriesActive = live
    .filter((m) => (running(m) || stillCaptured(m)) && age(m.moviemintId, 'series') > SERIES_TTL_MS && !failedRecently(m.moviemintId, 'series'))
    .sort((a, b) => age(b.moviemintId, 'series') - age(a.moviemintId, 'series'))
    .map((m) => t(m, 'boxoffice', null, 'series', 'series_active'));

  const advance: Task[] = [];
  for (const m of [...live].filter((x) => x.onAdvance).sort((a, b) => Number(upcoming(b)) - Number(upcoming(a)) || (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))) {
    const ttl = upcoming(m) ? ADVANCE_TTL_MS : RUNNING_ADVANCE_TTL_MS;
    if (age(m.moviemintId, 'advance') > ttl && !failedRecently(m.moviemintId, 'advance')) advance.push(t(m, 'advance', null, 'advance', 'advance'));
    for (const d of stored.get(m.slug)?.advanceDates ?? []) {
      const page = `advance:${d}`;
      if (d < today) continue;
      if (age(m.moviemintId, page) > ttl && !failedRecently(m.moviemintId, page)) advance.push(t(m, 'advance', d, page, 'advance'));
    }
  }

  // First fetch -- or again when a fetched movie has no stored summary (a
  // run stopped between writing its days and summarising them): the
  // summary is what the window / later-day plan below is built from.
  const seriesFirst = live
    .filter((m) => !running(m) && !stillCaptured(m) && !upcoming(m) && (!fetched.get(key(m.moviemintId, 'series'))?.ok || !stored.has(m.slug)) && !failedRecently(m.moviemintId, 'series'))
    .sort((a, b) => (b.lastTrackedDate ?? '').localeCompare(a.lastTrackedDate ?? ''))
    .map((m) => t(m, 'boxoffice', null, 'series', 'series_first'));

  const cumulative = live
    .filter((m) => {
      const s = stored.get(m.slug);
      if (!s || !s.availableDates.length || failedRecently(m.moviemintId, 'cumulative')) return false;
      const f = fetched.get(key(m.moviemintId, 'cumulative'));
      if (!f?.ok) return true;
      // still changing while the window is open
      return !!s.windowEnd && s.windowEnd >= addDays(today, -1) && now - f.at > CUMULATIVE_TTL_MS;
    })
    .map((m) => t(m, 'boxoffice', 'cumulative', 'cumulative', 'cumulative'));

  // Final window reports: newest date first, one movie after another.
  const windowStart = [MMI_ARCHIVE_START, addDays(today, -breakdownDays)].sort().pop()!;
  const byDate = new Map<string, Task[]>();
  const push = (d: string, task: Task) => byDate.set(d, [...(byDate.get(d) ?? []), task]);
  for (const m of live) {
    const s = stored.get(m.slug);
    if (!s) continue;
    for (const d of s.availableDates) {
      if (d >= today || d < windowStart || s.finalDates.has(d)) continue;
      const page = `date:${d}`;
      if (failedRecently(m.moviemintId, page) || age(m.moviemintId, page) < 24 * 3600_000) continue;
      push(d, t(m, 'boxoffice', d, page, 'date_final'));
    }
  }
  const finals = [...byDate.keys()].sort().reverse().flatMap((d) => byDate.get(d)!);

  // Later days: every date after the window up to the newest report
  // MovieMint has (yesterday at most; today comes with the live view).
  const later = new Map<string, Task[]>();
  for (const m of live) {
    const s = stored.get(m.slug);
    if (!s?.windowEnd || !s.latestSnapshot || s.latestSnapshot <= s.windowEnd) continue;
    const until = s.latestSnapshot < today ? s.latestSnapshot : addDays(today, -1);
    for (let d = addDays(s.windowEnd, 1); d <= until; d = addDays(d, 1)) {
      if (s.laterFinal.has(d)) continue;
      const page = `date:${d}`;
      if (failedRecently(m.moviemintId, page) || age(m.moviemintId, page) < 24 * 3600_000) continue;
      later.set(d, [...(later.get(d) ?? []), t(m, 'boxoffice', d, page, 'later_probe')]);
    }
  }
  const laterTasks = [...later.keys()].sort().reverse().flatMap((d) => later.get(d)!);

  const runningCum = cumulative.filter((c) => fetched.get(key(c.movieId, 'cumulative'))?.ok);
  const firstCum = cumulative.filter((c) => !fetched.get(key(c.movieId, 'cumulative'))?.ok);
  return [...seriesActive, ...advance, ...runningCum, ...seriesFirst, ...firstCum, ...finals, ...laterTasks];
}
