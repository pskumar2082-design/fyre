import fs from 'fs';
import path from 'path';
import type { FigureDay, FigureTotal, Movie, ReportedFigure } from './types';
import { demoFigures, demoMovies } from './demo';
import { isVercelProduction } from '@/lib/v2/flags';
import { supabase } from '@/lib/supabaseClient';

// Where the new movie pages read from:
//   MOVIES_SOURCE=demo  labelled test data (local only); admin selections
//                       are kept in .data/movies-flags.json
//   MOVIES_SOURCE=store Supabase mv_* tables, filled by the Sacnilk
//                       importer once it is approved
// The old BFILMY / MovieMint pages are untouched and keep their own data.

export type MovieFlags = Pick<Movie, 'showOnFyre' | 'featured' | 'override'>;

export interface MoviesStore {
  kind: 'demo' | 'store';
  listMovies(now: Date): Promise<Movie[]>;
  getMovie(now: Date, slug: string): Promise<Movie | null>;
  figures(now: Date, movieIds: string[]): Promise<{ days: FigureDay[]; totals: FigureTotal[]; reported: ReportedFigure[] }>;
}

export class MoviesUnavailableError extends Error {}

function flagsFile() {
  return process.env.MOVIES_FLAGS_FILE ?? path.join(process.cwd(), '.data', 'movies-flags.json');
}

// Preview sandbox: admin selections are kept in memory, never on disk.
const mem = globalThis as unknown as { __fyreMovieFlags?: Record<string, Partial<MovieFlags>> };
const inMemory = () => process.env.FYRE_PREVIEW_SANDBOX === '1' || !!process.env.VERCEL;

export function readDemoFlags(): Record<string, Partial<MovieFlags>> {
  if (inMemory()) return mem.__fyreMovieFlags ?? {};
  try {
    return JSON.parse(fs.readFileSync(flagsFile(), 'utf8'));
  } catch {
    return {};
  }
}

export function writeDemoFlags(all: Record<string, Partial<MovieFlags>>) {
  if (inMemory()) {
    mem.__fyreMovieFlags = all;
    return;
  }
  fs.mkdirSync(path.dirname(flagsFile()), { recursive: true });
  fs.writeFileSync(flagsFile(), JSON.stringify(all, null, 1));
}

const demoStore: MoviesStore = {
  kind: 'demo',
  async listMovies(now) {
    const flags = readDemoFlags();
    return demoMovies(now).map((m) => ({ ...m, ...flags[m.id] }));
  },
  async getMovie(now, slug) {
    return (await this.listMovies(now)).find((m) => m.slug === slug) ?? null;
  },
  async figures(now, ids) {
    const f = demoFigures(now);
    const keep = new Set(ids);
    return { days: f.days.filter((d) => keep.has(d.movieId)), totals: f.totals.filter((t) => keep.has(t.movieId)), reported: f.reported.filter((r) => keep.has(r.movieId)) };
  }
};

const toMovie = (r: any): Movie => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  primaryLanguage: r.primary_language,
  languages: r.languages ?? [],
  releaseDate: r.release_date,
  posterUrl: r.poster_url,
  certificate: r.certificate,
  lifecycle: r.lifecycle,
  lifecycleSince: r.lifecycle_since,
  showOnFyre: r.show_on_fyre,
  featured: r.featured,
  override: r.status_override,
  statusReason: r.status_reason ?? '',
  isTestData: false
});

const supabaseStore: MoviesStore = {
  kind: 'store',
  async listMovies() {
    const { data, error } = await supabase.from('mv_movie').select('*').order('release_date', { ascending: false }).limit(500);
    if (error) throw new Error(`mv_movie: ${error.message}`);
    return (data ?? []).map(toMovie);
  },
  async getMovie(_now, slug) {
    const { data, error } = await supabase.from('mv_movie').select('*').eq('slug', slug).maybeSingle();
    if (error) throw new Error(`mv_movie: ${error.message}`);
    return data ? toMovie(data) : null;
  },
  async figures(_now, ids) {
    if (!ids.length) return { days: [], totals: [], reported: [] };
    const [d, t, r] = await Promise.all([
      supabase.from('mv_figure_day').select('*').in('movie_id', ids).order('day', { ascending: false }).limit(5000),
      supabase.from('mv_figure_total').select('*').in('movie_id', ids),
      supabase.from('mv_reported_figure').select('*').in('movie_id', ids)
    ]);
    for (const x of [d, t, r]) if (x.error) throw new Error(x.error.message);
    return {
      days: (d.data ?? []).map((x: any) => ({ movieId: x.movie_id, source: x.source, day: x.day, dayNumber: x.day_number, metric: x.metric, value: Number(x.value), status: x.figure_status, sourceUpdatedAt: x.source_updated_at, fetchedAt: x.fetched_at })),
      totals: (t.data ?? []).map((x: any) => ({ movieId: x.movie_id, source: x.source, metric: x.metric, value: Number(x.value), status: x.figure_status, asOf: x.as_of, sourceUpdatedAt: x.source_updated_at, fetchedAt: x.fetched_at })),
      reported: (r.data ?? []).map((x: any) => ({ id: x.id, movieId: x.movie_id, metric: x.metric, value: Number(x.value), reportedBy: x.reported_by, sourceUrl: x.source_url, reportedOn: x.reported_on, enteredBy: x.entered_by }))
    };
  }
};

export function getMoviesStore(): MoviesStore {
  const kind = process.env.MOVIES_SOURCE ?? 'demo';
  if (kind === 'store') return supabaseStore;
  if (kind === 'demo') {
    if (isVercelProduction()) throw new MoviesUnavailableError('Test data is disabled in production');
    return demoStore;
  }
  throw new MoviesUnavailableError(`Unknown MOVIES_SOURCE "${kind}"`);
}
