'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, RotateCcw, Plus, X, Sparkles } from 'lucide-react';
import type { TTListedMovie, TTMovieDetails } from '@/lib/tracktollywood/types';
import { releaseTextFromMeta } from '@/lib/tracktollywood/meta';
import type { ComparisonMovie } from '@/lib/compare/types';
import { buildComparison } from '@/lib/compare/buildComparison';
import { modeKey, modeFromKey } from '@/lib/compare/mode';
import { SLUG_PARAMS, MAX_COMPARE_MOVIES } from '@/lib/compare/urlParams';
import { useMovieCatalog } from '@/lib/compare/useMovieCatalog';
import { Card, SectionHeading, EmptyState, Pill } from '@/components/ui';
import MovieSelector from '@/components/compare/MovieSelector';
import ComparisonTabs from '@/components/compare/ComparisonTabs';
import ComparisonStatCards from '@/components/compare/ComparisonStatCards';
import ComparisonGroupView from '@/components/compare/ComparisonGroupView';

// The interactive half of /compare -- everything app/compare/page.tsx's
// Server Component can't do itself (movie selection, tab switching,
// swap/reset, the merged view, URL persistence on every change). The
// Server Component already did the first parallel getMovieDetails()
// fetch for whatever slugs were in the URL on load, so this component
// only re-fetches a movie's details when the PERSON changes a selection
// (via the public /api/tracktollywood/[slug] route -- the same JSON the
// server itself reads from).
//
// initialSlugs/initialDetails/initialModeKey/initialAlign are read ONCE,
// as the initial state -- this component never re-syncs from its own
// props after mount (even though router.replace() below does cause
// app/compare/page.tsx to re-run server-side on every change). That's
// deliberate: this component's own state is the single source of truth
// once mounted, and the URL is a one-way OUTPUT of that state (for
// sharing/reload), never fed back in as new props while already mounted.
type Slot = { listed: TTListedMovie; details: TTMovieDetails | null; loading: boolean; error: string | null };

// TTMovieDetails doesn't carry TTListedMovie's own release-text/genre/
// gross-label fields (see lib/tracktollywood/types.ts) -- this adapts a
// server-fetched TTMovieDetails into the minimal TTListedMovie shape
// MovieSelector's collapsed "selected" view needs, reusing the exact
// same "find the Released/Releasing meta item" pattern
// app/movie/[slug]/page.tsx's own metaValue() already uses, rather than
// inventing a release date. Only used for a movie whose full details
// already arrived via the server -- every movie picked live from the
// dropdown already comes with a real TTListedMovie from the catalog.
function detailsToListed(d: TTMovieDetails): TTListedMovie {
  const releaseText = releaseTextFromMeta(d.meta);
  return {
    slug: d.slug,
    title: d.title,
    url: d.url,
    state: d.state,
    dayLabel: null,
    releaseText,
    genre: null,
    poster: d.poster,
    grossLabel: null,
    gross: null,
    grossCr: null,
    todayText: null,
    updatedText: null
  };
}

export default function ComparePageClient({
  initialSlugs,
  initialDetails,
  initialModeKey,
  initialAlign
}: {
  initialSlugs: string[];
  initialDetails: (TTMovieDetails | null)[];
  initialModeKey?: string;
  initialAlign: 'day' | 'date';
}) {
  const router = useRouter();
  const catalog = useMovieCatalog();

  // Computed once, from the props this component mounted with -- see the
  // comment above on why this never re-derives from props again later.
  const initialParsed = useMemo(() => {
    const slots: Slot[] = [];
    const failed: string[] = [];
    initialSlugs.forEach((slug, i) => {
      const details = initialDetails[i];
      if (details) slots.push({ listed: detailsToListed(details), details, loading: false, error: null });
      else failed.push(slug);
    });
    return { slots, failed };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [movies, setMovies] = useState<Slot[]>(initialParsed.slots);
  const [failedSlugs, setFailedSlugs] = useState<string[]>(initialParsed.failed);
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(MAX_COMPARE_MOVIES, Math.max(2, initialParsed.slots.length))
  );
  const [modeKeyRaw, setModeKeyRaw] = useState(initialModeKey ?? 'overview');
  const [align, setAlign] = useState<'day' | 'date'>(initialAlign);

  // Per-slot request counters so a rapid re-pick (choose movie X, then
  // immediately choose movie Y in the same slot before X's fetch
  // resolves) can never let the stale X response clobber Y once it
  // lands -- only the response matching the slot's CURRENT request id is
  // applied.
  const requestIdsRef = useRef<number[]>([0, 0, 0, 0]);
  function invalidateAllRequests() {
    requestIdsRef.current = requestIdsRef.current.map((n) => n + 1);
  }

  function selectMovie(index: number, listed: TTListedMovie) {
    const myId = ++requestIdsRef.current[index];
    setMovies((prev) => {
      const next = prev.slice();
      next[index] = { listed, details: null, loading: true, error: null };
      return next;
    });
    setFailedSlugs([]);

    fetch(`/api/tracktollywood/${encodeURIComponent(listed.slug)}`)
      .then(async (res) => ({ ok: res.ok, json: await res.json().catch(() => null) }))
      .then(({ ok, json }) => {
        if (requestIdsRef.current[index] !== myId) return;
        setMovies((prev) => {
          if (!prev[index] || prev[index].listed.slug !== listed.slug) return prev;
          const next = prev.slice();
          next[index] =
            ok && json
              ? { listed, details: json as TTMovieDetails, loading: false, error: null }
              : { listed, details: null, loading: false, error: json?.error ?? 'Could not load this movie right now.' };
          return next;
        });
      })
      .catch((err: any) => {
        if (requestIdsRef.current[index] !== myId) return;
        setMovies((prev) => {
          if (!prev[index] || prev[index].listed.slug !== listed.slug) return prev;
          const next = prev.slice();
          next[index] = { listed, details: null, loading: false, error: err?.message ?? 'Could not load this movie right now.' };
          return next;
        });
      });
  }

  // Removing a slot always shifts later movies down rather than leaving
  // a hole -- the selection stays front-packed (positions 0..N-1 always
  // filled before any empty selector), which is what keeps the a/b/c/d
  // URL params meaningful.
  function clearMovie(index: number) {
    invalidateAllRequests();
    setMovies((prev) => prev.filter((_, i) => i !== index));
  }

  function swapFirstTwo() {
    invalidateAllRequests();
    setMovies((prev) => {
      if (prev.length < 2) return prev;
      const next = prev.slice();
      [next[0], next[1]] = [next[1], next[0]];
      return next;
    });
  }

  function addSlot() {
    setVisibleCount((v) => Math.min(MAX_COMPARE_MOVIES, v + 1));
  }

  function removeLastSlot() {
    setVisibleCount((v) => {
      const nextCount = Math.max(2, v - 1);
      if (movies.length > nextCount) {
        invalidateAllRequests();
        setMovies((prev) => prev.slice(0, nextCount));
      }
      return nextCount;
    });
  }

  function resetAll() {
    invalidateAllRequests();
    setMovies([]);
    setFailedSlugs([]);
    setVisibleCount(2);
    setModeKeyRaw('overview');
    setAlign('day');
  }

  // Only movies whose details actually resolved feed the comparison --
  // a still-loading or failed slot simply isn't part of the comparison
  // yet, never a fabricated placeholder.
  const activeComparisonMovies: ComparisonMovie[] = useMemo(
    () =>
      movies
        .filter((s): s is Slot & { details: TTMovieDetails } => s.details != null)
        .map((s) => ({ slug: s.listed.slug, details: s.details })),
    [movies]
  );
  const vm = useMemo(() => buildComparison(activeComparisonMovies), [activeComparisonMovies]);
  const mode = useMemo(() => modeFromKey(modeKeyRaw, vm.groups), [modeKeyRaw, vm.groups]);

  // URL is a one-way OUTPUT of this component's own state (see the
  // top-of-file comment) -- skip the very first run since the URL
  // already matches what the server rendered.
  const skipNextSync = useRef(true);
  useEffect(() => {
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    const params = new URLSearchParams();
    movies.forEach((slot, i) => {
      if (SLUG_PARAMS[i]) params.set(SLUG_PARAMS[i], slot.listed.slug);
    });
    const normalizedMode = modeKey(mode);
    if (normalizedMode !== 'overview') params.set('mode', normalizedMode);
    if (align === 'date') params.set('align', 'date');
    const qs = params.toString();
    router.replace(qs ? `/compare?${qs}` : '/compare', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movies, mode, align]);

  const selectedSlugs = movies.map((s) => s.listed.slug);
  const selectorIndices = Array.from({ length: Math.max(visibleCount, movies.length) }, (_, i) => i);
  const canReset = movies.length > 0 || modeKeyRaw !== 'overview' || align !== 'day' || visibleCount !== 2;

  return (
    <div>
      <SectionHeading
        title="Movie Comparison"
        action={
          <div className="flex items-center gap-2">
            {movies.length >= 2 && (
              <Pill variant="outline" onClick={swapFirstTwo} className="!px-3.5 !py-1.5 !text-xs">
                <ArrowLeftRight size={13} className="mr-1.5" /> Swap
              </Pill>
            )}
            {canReset && (
              <Pill variant="outline" onClick={resetAll} className="!px-3.5 !py-1.5 !text-xs">
                <RotateCcw size={13} className="mr-1.5" /> Reset
              </Pill>
            )}
          </div>
        }
      />
      <p className="text-textFaint text-sm mb-6 -mt-3">
        Pick 2 to {MAX_COMPARE_MOVIES} movies to compare their box office performance, side by side.
      </p>

      {failedSlugs.length > 0 && (
        <div className="mb-4 text-xs text-red bg-red/[0.08] border border-red/20 rounded-xl px-4 py-3">
          {failedSlugs.length === 1
            ? `Could not load "${failedSlugs[0]}" — it may be unavailable or removed. Pick a movie below.`
            : `Could not load some of these movies (${failedSlugs.join(', ')}) — they may be unavailable or removed. Pick movies below.`}
        </div>
      )}

      <Card className="p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selectorIndices.map((i) => {
            const slot = movies[i];
            return (
              <div key={i}>
                <MovieSelector
                  movies={catalog.movies}
                  loading={catalog.loading}
                  error={catalog.error}
                  selected={slot?.listed ?? null}
                  onSelect={(m) => selectMovie(i, m)}
                  onClear={slot ? () => clearMovie(i) : undefined}
                  excludeSlugs={selectedSlugs.filter((s) => s !== slot?.listed.slug)}
                  label={`Movie ${String.fromCharCode(65 + i)}`}
                />
                {slot?.loading && <div className="text-[11px] text-textFaint mt-1.5">Loading {slot.listed.title}…</div>}
                {slot?.error && <div className="text-[11px] text-red mt-1.5">{slot.error}</div>}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-3.5">
          {visibleCount < MAX_COMPARE_MOVIES && (
            <button
              type="button"
              onClick={addSlot}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-goldBright transition"
            >
              <Plus size={14} /> Add movie
            </button>
          )}
          {visibleCount > 2 && movies.length < visibleCount && (
            <button
              type="button"
              onClick={removeLastSlot}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-textFaint hover:text-text transition"
            >
              <X size={14} /> Remove empty slot
            </button>
          )}
        </div>
      </Card>

      {activeComparisonMovies.length < 2 ? (
        <EmptyState>Pick at least 2 movies above to compare their box office performance.</EmptyState>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={16} className="text-gold" />
            <h2 className="hdisplay text-lg">Performance comparison</h2>
          </div>
          <Card className="p-4 sm:p-5">
            <ComparisonTabs groups={vm.groups} mode={mode} onChange={(m) => setModeKeyRaw(modeKey(m))} />
            {mode.kind === 'overview' ? (
              <ComparisonStatCards movies={vm.movies} stats={vm.stats} />
            ) : (
              (() => {
                const heading =
                  mode.kind === 'collections' ? 'Day-wise Collection' : mode.kind === 'cumulative' ? 'Cumulative' : mode.heading;
                const group = vm.groups.find((g) => g.heading === heading);
                if (!group) return <EmptyState>No data is available for this report yet.</EmptyState>;
                return <ComparisonGroupView group={group} movies={vm.movies} align={align} onAlignChange={setAlign} />;
              })()
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
