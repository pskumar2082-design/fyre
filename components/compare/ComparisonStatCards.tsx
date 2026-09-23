import type { ComparedStat, ComparisonMovie } from '@/lib/compare/types';
import { Card, EmptyState } from '@/components/ui';
import { movieDotClass } from './movieColors';

// Overview-mode metric cards: one card per stat label TrackTollywood
// actually published for at least one of the selected movies (the union
// buildComparison() already computed), each listing every movie's own
// value for that label -- never a single "winner" number, just every
// movie's own reported figure side by side so the person draws their own
// conclusion. A movie with no entry under this exact label reads "N/A"
// in a dim tone, visibly distinct from an actual reported value (even a
// reported "0" or "—" passes through unchanged, per lib/compare/types.ts's
// own null-vs-value contract).
export default function ComparisonStatCards({
  movies,
  stats,
  className = ''
}: {
  movies: ComparisonMovie[];
  stats: ComparedStat[];
  className?: string;
}) {
  if (stats.length === 0) {
    return <EmptyState>No comparable headline stats have been published for these movies yet.</EmptyState>;
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {stats.map((stat) => (
        <Card key={stat.label} className="p-5">
          <div className="mdtype-overline text-textFaint mb-3 truncate">{stat.label}</div>
          <div className="space-y-2.5">
            {movies.map((m, i) => (
              <div key={m.slug} className="flex items-center justify-between gap-3 min-w-0">
                <span className="flex items-center gap-2 min-w-0 text-sm text-textDim">
                  <span className={`w-2.5 h-2.5 rounded-full flex-none ${movieDotClass(i)}`} />
                  <span className="truncate">{m.details.title}</span>
                </span>
                <span
                  className={`font-stat font-bold text-base tabular-nums flex-none ${
                    stat.values[i] != null ? 'text-text' : 'text-textFaint'
                  }`}
                >
                  {stat.values[i] ?? 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
