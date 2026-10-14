// The movies BFILMY USA may be matched to under the MovieMint India policy:
// exactly the MovieMint catalog (mmi_catalog, linked). Same shape as
// lib/usa/sync.ts loadTrackedMovies, so the USA importer, matcher and
// backfill run unchanged on it. India Day 1 (the USA Day 1 rule) comes from
// MovieMint's India data; titles from MovieMint, Fyre and confirmed aliases.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { dayOneDate } from '@/lib/bfilmy/adapter';
import type { TrackedMovie } from '@/lib/usa/match';

const db = supabaseAdmin as any;

async function all(table: string, columns: string, apply: (q: any) => any = (q) => q): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await apply(db.from(table).select(columns)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export type PolicyTrackedMovie = TrackedMovie & { active: boolean; indiaDayOne: string | null; origin: string; title: string | null; hasIndia: boolean; languages: string[] };

export async function loadPolicyTrackedMovies(): Promise<PolicyTrackedMovie[]> {
  const [links, mm, india, fyre, aliases] = await Promise.all([
    all('mmi_catalog', 'moviemint_id,movie_id,slug', (q) => q.eq('link_status', 'linked')),
    all('mm_movie', 'moviemint_id,title,release_date,language'),
    all('mmi_movie', 'slug,title,release_date,first_date,carried_over,languages'),
    all('fyre_tracked_movie', 'moviemint_id,title,tracking_status,origin,languages,first_source_date'),
    all('fyre_movie_alias', 'movie_id,source_title', (q) => q.in('decision', ['created', 'matched']))
  ]);
  return buildPolicyTrackedMovies(links, mm, india, fyre, aliases);
}

// Pure: the MovieMint catalog as USA match targets. A Fyre movie that is
// not linked to a MovieMint movie (BFILMY-only) is never a target.
export function buildPolicyTrackedMovies(links: any[], mm: any[], india: any[], fyre: any[], aliases: any[]): PolicyTrackedMovie[] {
  const mmBy = new Map(mm.map((m) => [m.moviemint_id, m]));
  const indiaBy = new Map(india.map((m) => [m.slug, m]));
  const fyreBy = new Map(fyre.map((f) => [f.moviemint_id, f]));
  const titles = new Map<string, string[]>();
  for (const a of aliases) titles.set(a.movie_id, [...(titles.get(a.movie_id) ?? []), a.source_title]);
  return links
    .filter((l) => l.movie_id && l.slug)
    .map((l) => {
      const m = mmBy.get(l.moviemint_id);
      const b = indiaBy.get(l.slug);
      const f = fyreBy.get(l.movie_id);
      const indiaDayOne = b ? dayOneDate(b) ?? (!b.first_date && !b.carried_over ? b.release_date : null) : (m?.release_date ?? null);
      return {
        movieId: l.movie_id,
        slug: l.slug,
        titles: [...new Set([m?.title, b?.title, f?.title, ...(titles.get(l.movie_id) ?? [])].filter(Boolean))] as string[],
        dayOne: indiaDayOne ?? f?.first_source_date ?? null,
        indiaDayOne,
        // only an admin 'stopped' stops importing
        active: f?.tracking_status !== 'stopped',
        origin: f?.origin ?? 'moviemint',
        title: m?.title ?? f?.title ?? null,
        hasIndia: !!b && !!b.first_date,
        languages: [...new Set([...(b?.languages ?? []), ...(m?.language ? [m.language] : []), ...(f?.languages ?? [])])]
      };
    });
}
