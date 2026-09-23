import type { Metadata } from 'next';
import { getMovieDetails } from '@/lib/tracktollywood/scraper';
import { SITE_URL } from '@/lib/siteConfig';
import { SLUG_PARAMS } from '@/lib/compare/urlParams';
import ComparePageClient from './ComparePageClient';

// Same conventions app/box-office/page.tsx and app/movie/[slug]/page.tsx
// already use: force-dynamic (TrackTollywood data is live, never
// statically cached at the route level -- lib/tracktollywood/cache.ts's
// own short-TTL cache is the only caching layer), searchParams-driven
// state, and a separate generateMetadata that fetches independently
// (getMovieDetails is backed by that same short-TTL cache, so this
// doesn't double the real scrape load).
export const dynamic = 'force-dynamic';

type CompareSearchParams = { a?: string; b?: string; c?: string; d?: string; mode?: string; align?: string };

// Reads only the a/b/c/d slug params, in that fixed order, de-duplicated
// -- never more than SLUG_PARAMS.length movies, matching the up-to-4
// cap the rest of the comparison feature (lib/compare/types.ts) uses
// throughout.
function parseSlugs(searchParams: CompareSearchParams): string[] {
  const slugs: string[] = [];
  for (const key of SLUG_PARAMS) {
    const slug = searchParams[key];
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

export async function generateMetadata({ searchParams }: { searchParams: CompareSearchParams }): Promise<Metadata> {
  const fallback: Metadata = {
    title: 'Movie Comparison — Box Office Head to Head',
    description:
      'Compare box office collections, day-wise trends, language and state splits between two or more Telugu movies, side by side.',
    alternates: { canonical: `${SITE_URL}/compare` }
  };

  const slugs = parseSlugs(searchParams);
  if (slugs.length < 2) return fallback;

  let details: (Awaited<ReturnType<typeof getMovieDetails>>)[];
  try {
    details = await Promise.all(slugs.map((s) => getMovieDetails(s)));
  } catch {
    return fallback;
  }

  const titles = details.filter((d): d is NonNullable<typeof d> => d != null).map((d) => d.title);
  if (titles.length < 2) return fallback;

  const qs = slugs.map((s, i) => `${SLUG_PARAMS[i]}=${encodeURIComponent(s)}`).join('&');

  return {
    title: `${titles.join(' vs ')} — Box Office Comparison`,
    description: `Side-by-side box office comparison of ${titles.join(', ')}: collections, day-wise trends, language and state splits.`,
    alternates: { canonical: `${SITE_URL}/compare?${qs}` }
  };
}

export default async function ComparePage({ searchParams }: { searchParams: CompareSearchParams }) {
  const slugs = parseSlugs(searchParams);

  // Parallel fetch, tolerant of a bad/removed slug in the middle -- one
  // movie failing to load never blocks the others from rendering (see
  // Promise.allSettled, not Promise.all).
  const settled = await Promise.allSettled(slugs.map((slug) => getMovieDetails(slug)));
  const initialDetails = settled.map((r) => (r.status === 'fulfilled' ? r.value : null));

  const initialAlign: 'day' | 'date' = searchParams.align === 'date' ? 'date' : 'day';

  return (
    <div className="px-5 md:px-10 py-8 max-w-6xl mx-auto">
      <ComparePageClient
        initialSlugs={slugs}
        initialDetails={initialDetails}
        initialModeKey={searchParams.mode}
        initialAlign={initialAlign}
      />
    </div>
  );
}
