'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GitCompareArrows } from 'lucide-react';
import type { TTListedMovie, TTMovieDetails } from '@/lib/tracktollywood/types';
import type { ComparisonMovie } from '@/lib/compare/types';
import { buildComparison } from '@/lib/compare/buildComparison';
import { Card, Pill, EmptyState } from '@/components/ui';
import MovieSelector from './MovieSelector';
import ComparisonStatCards from './ComparisonStatCards';

// Compact home-page teaser for the full /compare page, placed
// immediately below the existing Box Office section (app/page.tsx).
// The two selectors are seeded from the SAME live+advance+upcoming+
// completed movie lists the rest of the homepage already fetched
// server-side -- no extra network call just to populate these
// dropdowns. Once both movies are picked, their full details are
// fetched via the same public /api/tracktollywood/[slug] route
// /compare itself uses, and run through the SAME buildComparison()
// adapter -- never a second, home-page-only comparison calculation --
// so the few stats previewed here can never quietly disagree with the
// full page.
export default function HomeCompareSection({ movies }: { movies: TTListedMovie[] }) {
  const [pickA, setPickA] = useState<TTListedMovie | null>(null);
  const [pickB, setPickB] = useState<TTListedMovie | null>(null);
  const [detailsA, setDetailsA] = useState<TTMovieDetails | null>(null);
  const [detailsB, setDetailsB] = useState<TTMovieDetails | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchDetails(slug: string): Promise<TTMovieDetails> {
    const res = await fetch(`/api/tracktollywood/${encodeURIComponent(slug)}`);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) throw new Error(json?.error ?? 'Could not load this movie right now.');
    return json as TTMovieDetails;
  }

  function pick(which: 'a' | 'b', movie: TTListedMovie) {
    setError(null);
    if (which === 'a') {
      setPickA(movie);
      setDetailsA(null);
      setLoadingA(true);
    } else {
      setPickB(movie);
      setDetailsB(null);
      setLoadingB(true);
    }
    fetchDetails(movie.slug)
      .then((details) => {
        if (which === 'a') setDetailsA(details);
        else setDetailsB(details);
      })
      .catch((err: any) => setError(err?.message ?? 'Could not load this movie right now.'))
      .finally(() => (which === 'a' ? setLoadingA(false) : setLoadingB(false)));
  }

  function clear(which: 'a' | 'b') {
    if (which === 'a') {
      setPickA(null);
      setDetailsA(null);
    } else {
      setPickB(null);
      setDetailsB(null);
    }
  }

  const comparisonMovies: ComparisonMovie[] = useMemo(() => {
    const list: ComparisonMovie[] = [];
    if (pickA && detailsA) list.push({ slug: pickA.slug, details: detailsA });
    if (pickB && detailsB) list.push({ slug: pickB.slug, details: detailsB });
    return list;
  }, [pickA, detailsA, pickB, detailsB]);

  const vm = useMemo(() => buildComparison(comparisonMovies), [comparisonMovies]);

  const bothPicked = Boolean(pickA && pickB);
  const anyLoading = loadingA || loadingB;
  const ready = comparisonMovies.length === 2;

  const compareHref =
    pickA && pickB ? `/compare?a=${encodeURIComponent(pickA.slug)}&b=${encodeURIComponent(pickB.slug)}` : '/compare';

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <GitCompareArrows size={17} className="text-gold" />
          <h2 className="hdisplay text-lg text-text">Movie Comparison</h2>
        </div>
        <Link href="/compare" className="text-xs font-semibold text-gold hover:underline">
          Full comparison →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <MovieSelector
          movies={movies}
          loading={false}
          selected={pickA}
          onSelect={(m) => pick('a', m)}
          onClear={pickA ? () => clear('a') : undefined}
          excludeSlugs={pickB ? [pickB.slug] : []}
          label="Movie A"
        />
        <MovieSelector
          movies={movies}
          loading={false}
          selected={pickB}
          onSelect={(m) => pick('b', m)}
          onClear={pickB ? () => clear('b') : undefined}
          excludeSlugs={pickA ? [pickA.slug] : []}
          label="Movie B"
        />
      </div>

      {error && <div className="text-xs text-red mb-3">{error}</div>}

      {!bothPicked ? (
        <EmptyState>Pick two movies above to see a quick comparison.</EmptyState>
      ) : (
        <>
          <div className="mb-4">
            {anyLoading ? (
              <div className="text-sm text-textFaint text-center py-6">Loading comparison…</div>
            ) : ready ? (
              <ComparisonStatCards movies={vm.movies} stats={vm.stats.slice(0, 3)} className="!grid-cols-1 sm:!grid-cols-3" />
            ) : (
              <EmptyState>Could not load full details for one of these movies right now.</EmptyState>
            )}
          </div>
          <Pill href={compareHref} variant="primary" className="w-full sm:w-auto justify-center">
            <GitCompareArrows size={15} className="mr-1.5" /> Compare Movies
          </Pill>
        </>
      )}
    </Card>
  );
}
