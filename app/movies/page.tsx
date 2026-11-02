import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { moviesV2Enabled } from '@/lib/v2/flags';
import { loadMoviesHome } from '@/lib/movies/public';
import { SITE_URL } from '@/lib/siteConfig';
import { EmptyState, SectionHeading } from '@/components/ui';
import { BoxOfficeTable, MoviesTestBanner, PosterCard } from '@/components/movies/MoviesBits';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Movies: now showing, box office and upcoming Telugu releases',
  description: 'Telugu movies in theatres now, labelled box office collections and upcoming releases.',
  alternates: { canonical: `${SITE_URL}/movies` }
};

export default async function MoviesHub() {
  if (!moviesV2Enabled()) notFound();
  const data = await loadMoviesHome();
  const now = new Date();
  return (
    <div className="fx-container py-8 sm:py-12">
      <SectionHeading title="Movies" subtitle="Telugu movies in theatres, box office and upcoming releases" />
      {!data.ok ? (
        <EmptyState>Movie listings are unavailable right now.</EmptyState>
      ) : (
        <>
          <MoviesTestBanner show={data.isTestData} />
          <h2 className="font-bold text-xl text-text mb-3">Now Showing</h2>
          {data.nowShowing.length === 0 ? (
            <EmptyState>No movies in theatres right now.</EmptyState>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {data.nowShowing.map((m) => (
                <PosterCard key={m.id} movie={m} now={now} />
              ))}
            </div>
          )}
          <section className="mt-8 rounded-xl border border-border bg-surface p-4 sm:p-5">
            <h2 className="font-bold text-xl text-text mb-2">Box Office</h2>
            <BoxOfficeTable rows={data.boxOffice} />
          </section>
          <h2 className="font-bold text-xl text-text mt-8 mb-3">Upcoming</h2>
          {data.upcoming.length === 0 ? (
            <EmptyState>No upcoming releases listed.</EmptyState>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {data.upcoming.map((m) => (
                <PosterCard key={m.id} movie={m} now={now} />
              ))}
            </div>
          )}
          <p className="mt-8 text-sm text-textFaint">
            Looking for reviews? <Link href="/reviews" className="underline hover:text-white">Read Fyre reviews</Link>.
          </p>
        </>
      )}
    </div>
  );
}
