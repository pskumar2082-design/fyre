import type { ComparisonMovie } from '@/lib/compare/types';
import { movieDotClass } from './movieColors';

// The color-to-movie key shared above the stat cards, table and chart on
// a comparison page/section -- so a color only has to be explained once
// per page rather than repeated in every component that uses it.
export default function MovieLegend({
  movies,
  className = ''
}: {
  movies: ComparisonMovie[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
      {movies.map((m, i) => (
        <span key={m.slug} className="flex items-center gap-2 text-sm min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full flex-none ${movieDotClass(i)}`} />
          <span className="truncate max-w-[220px] font-medium text-text">{m.details.title}</span>
        </span>
      ))}
    </div>
  );
}
