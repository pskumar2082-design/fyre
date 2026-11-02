import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { moviesV2Enabled } from '@/lib/v2/flags';
import { getMoviesStore } from '@/lib/movies/store';
import { dayRows, formatValue, latestReported, METRIC_LABEL, MONEY, pickSource, SOURCE_LABEL, sourcePreference, totalsFor } from '@/lib/movies/figures';
import { effectiveLifecycle, isPubliclySelected } from '@/lib/movies/lifecycle';
import type { Metric } from '@/lib/movies/types';
import { SITE_URL } from '@/lib/siteConfig';
import { EmptyState } from '@/components/ui';
import { FigureBadge, MoviesTestBanner } from '@/components/movies/MoviesBits';

export const revalidate = 300;

async function load(slug: string) {
  const store = getMoviesStore();
  const now = new Date();
  const movie = await store.getMovie(now, slug);
  if (!movie || !isPubliclySelected(movie)) return null;
  const f = await store.figures(now, [movie.id]);
  return { movie, f, isTestData: store.kind === 'demo' };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  if (!moviesV2Enabled()) return {};
  const r = await load(params.slug).catch(() => null);
  if (!r) return {};
  return {
    title: `${r.movie.title} box office collection`,
    description: `Day-wise box office for ${r.movie.title}, with every figure labelled as an estimate or a reported number.`,
    alternates: { canonical: `${SITE_URL}/movies/${r.movie.slug}` },
    robots: r.isTestData ? { index: false, follow: false } : undefined
  };
}

const LIFECYCLE_TEXT = {
  upcoming: 'Upcoming',
  now_showing: 'In theatres',
  ending_check: 'In theatres (last days)',
  run_ended: 'Theatrical run ended',
  archived: 'Theatrical run ended'
} as const;

export default async function MoviePage({ params }: { params: { slug: string } }) {
  if (!moviesV2Enabled()) notFound();
  const r = await load(params.slug);
  if (!r) notFound();
  const { movie, f } = r;
  const sources = [...new Set([...f.days.map((d) => d.source), ...f.totals.map((t) => t.source)])];
  const source = pickSource(sources, sourcePreference());
  const rows = source ? dayRows(f.days, source) : [];
  const totals = source ? totalsFor(f.totals, source) : {};
  const lc = effectiveLifecycle(movie);
  const ended = lc === 'run_ended' || lc === 'archived';

  return (
    <div className="fx-container py-8 sm:py-12 max-w-5xl">
      <Link href="/movies" className="inline-flex items-center gap-2 text-sm text-textDim hover:text-white mb-5">
        <ArrowLeft className="w-4 h-4" /> Movies
      </Link>
      <MoviesTestBanner show={r.isTestData} />
      {ended && <div className="mb-5 rounded-xl border border-border bg-surface2 px-4 py-3 text-sm text-textDim">Theatrical run ended. This page keeps the full box office history.</div>}
      <h1 className="hdisplay font-extrabold text-3xl sm:text-4xl text-text">{movie.title}</h1>
      <p className="font-mono text-sm text-textDim mt-2">
        {LIFECYCLE_TEXT[lc]} · {movie.languages.join(', ')} · Released {movie.releaseDate ?? 'TBA'}
        {movie.certificate ? ` · ${movie.certificate}` : ''}
      </p>

      <section className="mt-8">
        <h2 className="font-bold text-xl text-text mb-3">Totals</h2>
        {!source ? (
          <EmptyState>No box office figures yet.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {MONEY.map((metric) => {
              const t = totals[metric];
              return (
                <div key={metric} className="rounded-xl border border-border bg-surface p-4">
                  <div className="text-xs text-textFaint">{METRIC_LABEL[metric]}</div>
                  <div className="font-mono font-bold text-xl text-text mt-1">{formatValue(metric, t?.value)}</div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {t && <FigureBadge status={t.status} />}
                    {t?.asOf && <span className="font-mono text-[10px] text-textFaint">to {t.asOf}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {source && <p className="mt-2 font-mono text-[11px] text-textFaint">Source: {SOURCE_LABEL[source]}. Totals are shown as the source states them; Fyre does not add figures together.</p>}
      </section>

      {f.reported.length > 0 && (
        <section className="mt-8 rounded-xl border border-goldDim/40 bg-goldDim/5 p-4 sm:p-5">
          <h2 className="font-bold text-lg text-text mb-2">Reported figures</h2>
          <p className="text-sm text-textDim mb-3">Announced by the producer or studio. Shown separately from estimates and never combined with them.</p>
          <ul className="space-y-2 text-sm">
            {(['worldwide_gross', 'india_gross', 'india_net', 'overseas_gross'] as Metric[]).map((m) => {
              const rep = latestReported(f.reported, m);
              if (!rep) return null;
              return (
                <li key={m} className="flex flex-wrap items-center gap-2">
                  <FigureBadge status="reported" />
                  <span className="text-text font-semibold">
                    {METRIC_LABEL[m]}: {formatValue(m, rep.value)}
                  </span>
                  <span className="text-textFaint">
                    · {rep.reportedBy}, {rep.reportedOn} ·{' '}
                    <a href={rep.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-white">
                      announcement
                    </a>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-bold text-xl text-text mb-3">Day-wise</h2>
        {rows.length === 0 ? (
          <EmptyState>No day-wise figures yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-textFaint">
                  <th className="text-left font-normal px-3 py-2">Day</th>
                  <th className="text-right font-normal px-3 py-2">India net</th>
                  <th className="text-right font-normal px-3 py-2">India gross</th>
                  <th className="text-right font-normal px-3 py-2">Occupancy</th>
                  <th className="text-right font-normal px-3 py-2">Shows</th>
                  <th className="text-right font-normal px-3 py-2">Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface2">
                {rows.map((row) => {
                  const status = row.values.india_net?.status ?? row.values.india_gross?.status;
                  return (
                    <tr key={row.day}>
                      <td className="px-3 py-2 text-text whitespace-nowrap">
                        Day {row.dayNumber ?? '?'} <span className="font-mono text-xs text-textFaint">{row.day}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text">{formatValue('india_net', row.values.india_net?.value)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatValue('india_gross', row.values.india_gross?.value)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatValue('occupancy_pct', row.values.occupancy_pct?.value)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatValue('shows', row.values.shows?.value)}</td>
                      <td className="px-3 py-2 text-right">{status && <FigureBadge status={status} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
