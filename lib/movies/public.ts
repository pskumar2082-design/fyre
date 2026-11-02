import { moviesV2Enabled } from '@/lib/v2/flags';
import { getMoviesStore } from './store';
import { inActiveListings, inUpcoming } from './lifecycle';
import { pickSource, sourcePreference, totalsFor } from './figures';
import type { FigureDay, FigureTotal, Metric, Movie } from './types';

export type BoxOfficeRow = {
  movie: Movie;
  source: string | null;
  latestDay: { day: string; dayNumber: number | null; india_net?: FigureDay; occupancy?: FigureDay } | null;
  totals: Partial<Record<Metric, FigureTotal>>;
};

export type MoviesHome = { ok: true; isTestData: boolean; nowShowing: Movie[]; upcoming: Movie[]; boxOffice: BoxOfficeRow[] } | { ok: false };

// Public listings: only Telugu movies in theatres plus admin-selected
// others; ended and archived runs never appear in the active lists.
export async function loadMoviesHome(): Promise<MoviesHome> {
  if (!moviesV2Enabled()) return { ok: false };
  try {
    const store = getMoviesStore();
    const now = new Date();
    const all = await store.listMovies(now);
    const nowShowing = all.filter(inActiveListings).sort((a, b) => Number(b.featured) - Number(a.featured) || (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
    const upcoming = all.filter(inUpcoming).sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''));
    const f = await store.figures(now, nowShowing.map((m) => m.id));
    const preference = sourcePreference();
    const boxOffice: BoxOfficeRow[] = nowShowing.map((movie) => {
      const days = f.days.filter((d) => d.movieId === movie.id);
      const source = pickSource([...new Set([...days.map((d) => d.source), ...f.totals.filter((t) => t.movieId === movie.id).map((t) => t.source)])], preference);
      if (!source) return { movie, source: null, latestDay: null, totals: {} };
      const mine = days.filter((d) => d.source === source);
      const lastDay = mine.map((d) => d.day).sort().pop();
      const latest = lastDay ? mine.filter((d) => d.day === lastDay) : [];
      return {
        movie,
        source,
        latestDay: lastDay ? { day: lastDay, dayNumber: latest[0]?.dayNumber ?? null, india_net: latest.find((d) => d.metric === 'india_net'), occupancy: latest.find((d) => d.metric === 'occupancy_pct') } : null,
        totals: totalsFor(f.totals.filter((t) => t.movieId === movie.id), source)
      };
    });
    return { ok: true, isTestData: store.kind === 'demo', nowShowing, upcoming, boxOffice };
  } catch (err: any) {
    console.error('loadMoviesHome:', err?.message ?? err);
    return { ok: false };
  }
}
