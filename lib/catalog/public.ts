// Fyre's canonical catalog, read by public pages (anon key, Supabase only --
// nothing here ever contacts a source site). Every Fyre movie has one
// public slug (fyre_tracked_movie.bf_slug); a movie created from a source
// listing may have USA data only, India data only, or both.
import { supabase } from '@/lib/supabaseClient';
import { moviemintIndia } from '@/lib/sourcePolicy';

export type CatalogMovie = {
  movieId: string;
  slug: string;
  title: string;
  poster: string | null;
  languages: string[];
  releaseDate: string | null;
  releaseYear: number | null;
  origin: string;
};

const PUBLIC_STATUSES = ['active', 'ended', 'stopped'];
const db = supabase as any;

function toMovie(r: any): CatalogMovie {
  return {
    movieId: r.moviemint_id,
    slug: r.bf_slug,
    title: r.title ?? r.bf_slug,
    poster: r.metadata?.poster ?? null,
    languages: r.languages ?? [],
    releaseDate: r.release_date ?? null,
    releaseYear: r.release_year ?? null,
    origin: r.origin ?? 'moviemint'
  };
}

let memo: { at: number; value: Promise<CatalogMovie[]> } | null = null;

// Public movies that were created from a source listing (not MovieMint).
// [] before migration_catalog.sql has been run.
export function createdMovies(): Promise<CatalogMovie[]> {
  if (memo && Date.now() - memo.at < 60_000) return memo.value;
  const value = (async () => {
    // MovieMint India policy: every catalog movie, with MovieMint metadata
    // (title, poster, language, release date) -- used for movies without
    // India rows yet and for USA-only cards.
    if (moviemintIndia()) return policyMovies();
    const { data, error } = await db
      .from('fyre_tracked_movie')
      .select('moviemint_id,bf_slug,title,metadata,languages,release_date,release_year,origin')
      .eq('match_status', 'matched')
      .in('tracking_status', PUBLIC_STATUSES)
      .neq('origin', 'moviemint')
      .not('bf_slug', 'is', null);
    if (error) return [];
    return (data ?? []).map(toMovie);
  })();
  memo = { at: Date.now(), value };
  return value;
}

async function policyMovies(): Promise<CatalogMovie[]> {
  const [{ data: links, error }, { data: mm }] = await Promise.all([
    db.from('mmi_catalog').select('moviemint_id,movie_id,slug').eq('link_status', 'linked').not('slug', 'is', null),
    db.from('mm_movie').select('moviemint_id,title,poster,language,release_date')
  ]);
  if (error) return [];
  const mmBy = new Map((mm ?? []).map((m: any) => [m.moviemint_id, m]));
  return (links ?? []).map((l: any) => {
    const m: any = mmBy.get(l.moviemint_id) ?? {};
    return {
      movieId: l.movie_id,
      slug: l.slug,
      title: m.title ?? l.slug,
      poster: m.poster ?? null,
      languages: m.language ? [m.language] : [],
      releaseDate: m.release_date ?? null,
      releaseYear: m.release_date ? Number(String(m.release_date).slice(0, 4)) : null,
      origin: 'moviemint'
    };
  });
}

export async function catalogMovie(slug: string): Promise<CatalogMovie | null> {
  return (await createdMovies()).find((m) => m.slug === slug) ?? null;
}
