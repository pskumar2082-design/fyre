'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GitCompareArrows } from 'lucide-react';
import type { TTListedMovie } from '@/lib/boxoffice/types';
import type { Comparison, MetricKey } from '@/lib/analytics/types';
import { formatMetric } from '@/lib/analytics/format';
import { METRIC_LABELS } from '@/lib/analytics/metrics';
import { Card, EmptyState } from '@/components/ui';
import MovieSelector from './MovieSelector';
import { movieTextClass } from './movieColors';

// Homepage teaser for Movie Comparison: lifetime headline figures for two
// picked movies, from the same /api/analytics/compare view model as the
// full /compare page.
const ROWS: MetricKey[] = ['gross', 'tickets', 'occupancy'];

export default function HomeCompareSection({ movies }: { movies: TTListedMovie[] }) {
  const [pickA, setPickA] = useState<TTListedMovie | null>(null);
  const [pickB, setPickB] = useState<TTListedMovie | null>(null);
  const [data, setData] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!pickA || !pickB) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/analytics/compare?movies=${encodeURIComponent(pickA.slug)},${encodeURIComponent(pickB.slug)}&basis=lifetime&trend=0`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setData(j as Comparison);
      })
      .catch((e) => e.name !== 'AbortError' && setError(e.message || 'Could not load this comparison right now.'))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [pickA, pickB]);

  const compareHref = pickA && pickB ? `/compare?movies=${encodeURIComponent(pickA.slug)},${encodeURIComponent(pickB.slug)}&basis=day&day=1&dimension=state` : '/compare';

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
        <MovieSelector movies={movies} loading={false} selected={pickA} onSelect={setPickA} onClear={pickA ? () => setPickA(null) : undefined} excludeSlugs={pickB ? [pickB.slug] : []} label="Movie A" />
        <MovieSelector movies={movies} loading={false} selected={pickB} onSelect={setPickB} onClear={pickB ? () => setPickB(null) : undefined} excludeSlugs={pickA ? [pickA.slug] : []} label="Movie B" />
      </div>

      {error && <div className="text-xs text-red mb-3">{error}</div>}

      {!pickA || !pickB ? (
        <EmptyState>Pick two movies above to see a quick comparison.</EmptyState>
      ) : loading || !data ? (
        <div className="text-sm text-textFaint text-center py-6">Loading comparison…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {ROWS.map((k) => (
              <div key={k} className="rounded-xl border border-border p-3">
                <div className="mdtype-overline text-textFaint mb-1.5">Lifetime {METRIC_LABELS[k]}</div>
                {data.movies.map((m, i) => (
                  <div key={m.slug} className="flex justify-between text-sm">
                    <span className="text-textDim truncate mr-2">{m.title}</span>
                    <span className={`font-stat font-bold ${movieTextClass(i)}`}>{formatMetric(k, m.summary ? (m.summary[k] as number | null) : null)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <Link href={compareHref} className="text-xs font-semibold text-gold hover:underline">
            Compare Day 1 vs Day 1, states, languages and more →
          </Link>
        </>
      )}
    </Card>
  );
}
