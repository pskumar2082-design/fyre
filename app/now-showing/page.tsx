import Link from 'next/link';
import { getLiveMovies } from '@/lib/tracktollywood/scraper';

import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: 'Now Showing — Live Telugu Box Office Collections',
  description: 'Every Telugu movie currently running, with live day-wise box office collections updated throughout the day.',
  alternates: { canonical: `${SITE_URL}/now-showing` }
};
import MovieCard from '@/components/MovieCard';
import { SectionHeading, EmptyState, Pill } from '@/components/ui';

// TrackTollywood-backed, not Supabase -- see lib/tracktollywood/scraper.ts.
// Cached 5 min there, so this page doesn't need its own revalidate window.
export const dynamic = 'force-dynamic';

type SortKey = 'gross' | 'az';

export default async function NowShowingPage({ searchParams }: { searchParams: { sort?: string } }) {
  let movies: Awaited<ReturnType<typeof getLiveMovies>> = [];
  let loadError: string | null = null;
  try {
    movies = await getLiveMovies();
  } catch (err: any) {
    loadError = err?.message ?? 'Could not reach TrackTollywood right now.';
  }
  // "Now showing" means actually released and running -- advance-booking
  // and not-yet-released movies belong on /upcoming instead, even though
  // TrackTollywood's own default listing mixes all three together.
  const sort: SortKey = searchParams.sort === 'az' ? 'az' : 'gross';
  const nowShowing = movies
    .filter((m) => m.state === 'live')
    .sort((a, b) => (sort === 'az' ? a.title.localeCompare(b.title) : (b.grossCr ?? 0) - (a.grossCr ?? 0)));

  return (
    <div className="px-5 md:px-10 py-8">
      <SectionHeading
        title="Now showing"
        action={<Link href="/box-office" className="text-gold text-sm font-semibold hover:underline">Full box office archive →</Link>}
      />
      <p className="text-textFaint text-sm mb-6 -mt-3">
        Every movie currently running, tracked live day-wise, city-wise, state-wise, language-wise and format-wise.
      </p>

      <div className="flex items-center gap-2 mb-6">
        <Pill href="/now-showing?sort=gross" variant={sort === 'gross' ? 'active' : 'default'} className="!px-4 !py-1.5 !text-xs">
          Highest gross
        </Pill>
        <Pill href="/now-showing?sort=az" variant={sort === 'az' ? 'active' : 'default'} className="!px-4 !py-1.5 !text-xs">
          A – Z
        </Pill>
        <span className="text-textFaint text-xs ml-auto">{nowShowing.length} in theaters</span>
      </div>

      {loadError ? (
        <EmptyState>Could not load right now ({loadError}). Try again shortly.</EmptyState>
      ) : nowShowing.length === 0 ? (
        <EmptyState>Nothing currently in theaters.</EmptyState>
      ) : (
        <div className="flex flex-wrap gap-4">
          {nowShowing.map((m, i) => (
            <MovieCard key={m.slug} movie={m} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
