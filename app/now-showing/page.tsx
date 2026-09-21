import Link from 'next/link';
import { getLiveMovies } from '@/lib/tracktollywood/scraper';
import MovieCard from '@/components/MovieCard';
import { SectionHeading, EmptyState } from '@/components/ui';

// TrackTollywood-backed, not Supabase -- see lib/tracktollywood/scraper.ts.
// Cached 5 min there, so this page doesn't need its own revalidate window.
export const dynamic = 'force-dynamic';

export default async function NowShowingPage() {
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
  const nowShowing = movies.filter((m) => m.state === 'live');

  return (
    <div className="px-5 md:px-10 py-8">
      <SectionHeading
        title="Now showing"
        action={<Link href="/box-office" className="text-gold text-sm font-semibold hover:underline">Full box office archive →</Link>}
      />
      <p className="text-textFaint text-sm mb-8 -mt-3">
        Every movie currently running, tracked live day-wise, city-wise, state-wise, language-wise and format-wise.
      </p>

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
