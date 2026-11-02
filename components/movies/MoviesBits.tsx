import Link from 'next/link';
import Image from 'next/image';
import { FlaskConical } from 'lucide-react';
import type { FigureStatus, Movie } from '@/lib/movies/types';
import type { BoxOfficeRow } from '@/lib/movies/public';
import { formatValue, SOURCE_LABEL, STATUS_LABEL } from '@/lib/movies/figures';

export function FigureBadge({ status }: { status: FigureStatus }) {
  const style = status === 'reported' ? 'bg-goldDim/15 text-goldDim' : status === 'early_estimate' ? 'bg-amber/15 text-amber' : 'bg-surface2 text-textDim';
  return <span className={`inline-block font-mono text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 whitespace-nowrap ${style}`}>{status === 'early_estimate' ? 'Early estimate' : STATUS_LABEL[status]}</span>;
}

export function MoviesTestBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div role="note" className="mb-6 rounded-xl border border-amber/60 bg-amber/10 px-4 py-3 flex items-start gap-3">
      <FlaskConical className="w-5 h-5 text-amber flex-none mt-0.5" />
      <div className="text-sm">
        <p className="font-bold text-text">Test data: these are not real collections</p>
        <p className="text-textDim mt-0.5">Movie titles start with &ldquo;Sample:&rdquo; and every figure is made up. Real figures appear only after the Sacnilk importer is reviewed and approved.</p>
      </div>
    </div>
  );
}

function dayLabel(m: Movie, now: Date): string {
  if (!m.releaseDate) return '';
  const days = Math.floor((now.getTime() - Date.parse(`${m.releaseDate}T00:00:00+05:30`)) / 86_400_000);
  if (days < 0) return `Releases ${new Date(`${m.releaseDate}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  return `Day ${days + 1}`;
}

export function PosterCard({ movie, now, className = 'w-[150px] sm:w-[170px]' }: { movie: Movie; now: Date; className?: string }) {
  return (
    <Link href={`/movies/${movie.slug}`} className={`group flex-none ${className}`}>
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface2 border border-border group-hover:border-borderStrong transition">
        {movie.posterUrl ? (
          <Image src={movie.posterUrl} alt="" fill unoptimized sizes="170px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center bg-gradient-to-b from-surface2 to-black">
            <span className="font-bold text-text text-sm leading-snug">{movie.title.replace(/^Sample:\s*/, '')}</span>
          </div>
        )}
        {movie.lifecycle === 'ending_check' && <span className="absolute top-2 left-2 font-mono text-[10px] font-bold uppercase bg-black/80 text-textDim rounded px-1.5 py-1">Last days</span>}
      </div>
      <span className="block mt-2 text-sm font-semibold text-text truncate group-hover:text-gold">{movie.title}</span>
      <span className="block font-mono text-[11px] text-textFaint">
        {movie.primaryLanguage} · {dayLabel(movie, now)}
      </span>
    </Link>
  );
}

export function BoxOfficeTable({ rows, compact = false }: { rows: BoxOfficeRow[]; compact?: boolean }) {
  if (!rows.length) return <p className="text-sm text-textFaint py-4">Box office figures will appear here.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-textFaint">
            <th className="text-left font-normal px-2 py-2">Movie</th>
            <th className="text-right font-normal px-2 py-2">Latest day, India net</th>
            {!compact && <th className="text-right font-normal px-2 py-2">Occupancy</th>}
            <th className="text-right font-normal px-2 py-2">Total India net</th>
            {!compact && <th className="text-right font-normal px-2 py-2">Worldwide gross</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface2">
          {rows.map((r) => (
            <tr key={r.movie.id} className="align-top">
              <td className="px-2 py-2.5">
                <Link href={`/movies/${r.movie.slug}`} className="font-semibold text-text hover:text-gold">
                  {r.movie.title}
                </Link>
                <span className="block font-mono text-[11px] text-textFaint">
                  {r.latestDay ? `Day ${r.latestDay.dayNumber ?? '?'}` : 'No figures yet'}
                  {r.source ? ` · ${SOURCE_LABEL[r.source as keyof typeof SOURCE_LABEL] ?? r.source}` : ''}
                </span>
              </td>
              <td className="px-2 py-2.5 text-right font-mono">
                <span className="block text-text">{formatValue('india_net', r.latestDay?.india_net?.value)}</span>
                {r.latestDay?.india_net && <FigureBadge status={r.latestDay.india_net.status} />}
              </td>
              {!compact && <td className="px-2 py-2.5 text-right font-mono text-textDim">{formatValue('occupancy_pct', r.latestDay?.occupancy?.value)}</td>}
              <td className="px-2 py-2.5 text-right font-mono">
                <span className="block text-text font-bold">{formatValue('india_net', r.totals.india_net?.value)}</span>
                {r.totals.india_net && <FigureBadge status={r.totals.india_net.status} />}
              </td>
              {!compact && (
                <td className="px-2 py-2.5 text-right font-mono">
                  <span className="block text-text">{formatValue('worldwide_gross', r.totals.worldwide_gross?.value)}</span>
                  {r.totals.worldwide_gross && <FigureBadge status={r.totals.worldwide_gross.status} />}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 px-2 font-mono text-[11px] text-textFaint">Each row uses one source. Figures from different sources are never added together.</p>
    </div>
  );
}
