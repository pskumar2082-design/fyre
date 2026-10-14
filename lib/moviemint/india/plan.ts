// Which MovieMint pages to fetch next. Pure (no I/O), unit-tested.
import type { MmiKind } from './parse';
import { addDays } from './normalize';

export const MMI_BREAKDOWN_DAYS = Number(process.env.MMI_BREAKDOWN_DAYS ?? 90);
const SERIES_TTL_MS = Number(process.env.MMI_SERIES_TTL_MIN ?? 110) * 60_000;
const ADVANCE_TTL_MS = Number(process.env.MMI_ADVANCE_TTL_MIN ?? 170) * 60_000; // upcoming releases
const RUNNING_ADVANCE_TTL_MS = Number(process.env.MMI_RUNNING_ADVANCE_TTL_MIN ?? 360) * 60_000; // next-day bookings of running films
const RETRY_FAILED_MS = 6 * 3600_000;

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
  lastTrackedDate: string | null;
  stopped: boolean;
};

export type Task = PageRequest & { slug: string; reason: 'series_active' | 'advance' | 'series_first' | 'date_final' };

export function planTasks(
  movies: LinkedMovie[],
  fetched: Map<string, { at: number; ok: boolean }>,
  stored: Map<string, { availableDates: string[]; finalDates: Set<string>; lastDate: string | null }>,
  now: number,
  today: string,
  breakdownDays = MMI_BREAKDOWN_DAYS
): Task[] {
  const key = (id: string, page: string) => `${id}|${page}`;
  const age = (id: string, page: string) => {
    const f = fetched.get(key(id, page));
    return f ? now - f.at : Infinity;
  };
  const failedRecently = (id: string, page: string) => {
    const f = fetched.get(key(id, page));
    return !!f && !f.ok && now - f.at < RETRY_FAILED_MS;
  };
  const live = movies.filter((m) => !m.stopped);
  const running = (m: LinkedMovie) =>
    (m.onList || m.onAdvance) &&
    ((m.lastTrackedDate != null && m.lastTrackedDate >= addDays(today, -3)) || (m.releaseDate != null && m.releaseDate >= addDays(today, -7) && m.releaseDate <= today));
  const upcoming = (m: LinkedMovie) => (m.onList || m.onAdvance) && m.releaseDate != null && m.releaseDate > today;

  const seriesActive: Task[] = live
    .filter((m) => running(m) && age(m.moviemintId, 'series') > SERIES_TTL_MS && !failedRecently(m.moviemintId, 'series'))
    .sort((a, b) => age(b.moviemintId, 'series') - age(a.moviemintId, 'series'))
    .map((m) => ({ movieId: m.moviemintId, slug: m.slug, kind: 'boxoffice', date: null, page: 'series', reason: 'series_active' }));

  const advance: Task[] = live
    // only movies MovieMint lists with advance sales open
    .filter((m) => m.onAdvance && age(m.moviemintId, 'advance') > (upcoming(m) ? ADVANCE_TTL_MS : RUNNING_ADVANCE_TTL_MS) && !failedRecently(m.moviemintId, 'advance'))
    // upcoming releases first (soonest first), then running films' next-day bookings
    .sort((a, b) => Number(upcoming(b)) - Number(upcoming(a)) || (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))
    .map((m) => ({ movieId: m.moviemintId, slug: m.slug, kind: 'advance', date: null, page: 'advance', reason: 'advance' }));

  const seriesFirst: Task[] = live
    .filter((m) => !running(m) && !upcoming(m) && !fetched.get(key(m.moviemintId, 'series'))?.ok && !failedRecently(m.moviemintId, 'series'))
    .sort((a, b) => (b.lastTrackedDate ?? '').localeCompare(a.lastTrackedDate ?? ''))
    .map((m) => ({ movieId: m.moviemintId, slug: m.slug, kind: 'boxoffice', date: null, page: 'series', reason: 'series_first' }));

  // Final breakdowns: newest date first, one movie after another per date
  // (yesterday for every movie before the day before for any).
  const windowStart = addDays(today, -breakdownDays);
  const byDate = new Map<string, Task[]>();
  for (const m of live) {
    const s = stored.get(m.slug);
    if (!s) continue;
    for (const d of s.availableDates) {
      if (d >= today || d < windowStart || s.finalDates.has(d)) continue;
      const page = `date:${d}`;
      if (failedRecently(m.moviemintId, page)) continue;
      // fetched after the day ended and still not final = MovieMint has no
      // breakdown for it; do not refetch more than once a day
      if (age(m.moviemintId, page) < 24 * 3600_000) continue;
      const list = byDate.get(d) ?? [];
      list.push({ movieId: m.moviemintId, slug: m.slug, kind: 'boxoffice', date: d, page, reason: 'date_final' });
      byDate.set(d, list);
    }
  }
  const dates = [...byDate.keys()].sort().reverse();
  const finals = dates.flatMap((d) => byDate.get(d)!);
  return [...seriesActive, ...advance, ...seriesFirst, ...finals];
}

