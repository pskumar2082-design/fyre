import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { sportsEnabled } from '@/lib/v2/flags';
import { loadSports } from '@/lib/sports/load';
import { applyFilter, parseFilter } from '@/lib/sports/source';
import { SITE_URL } from '@/lib/siteConfig';
import { SectionHeading, EmptyState } from '@/components/ui';
import MatchCard from '@/components/sports/MatchCard';
import { FilterTabs, TestDataBanner } from '@/components/sports/SportsBits';
import AutoRefresh from '@/components/sports/AutoRefresh';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Live cricket scores',
  description: 'Live cricket scores for India matches, the IPL and international cricket, with the time of every update.',
  alternates: { canonical: `${SITE_URL}/live-scores` }
};

export default async function LiveScoresPage({ searchParams }: { searchParams: { filter?: string } }) {
  if (!sportsEnabled()) notFound();
  const filter = parseFilter(searchParams.filter);
  const data = await loadSports();

  return (
    <div className="fx-container py-8 sm:py-12">
      <AutoRefresh seconds={60} />
      <SectionHeading title="Live Scores" subtitle="Live and next-up matches" />
      {!data.ok ? (
        <EmptyState>Live cricket is unavailable right now. Scores will return as soon as the feed is back.</EmptyState>
      ) : (
        <>
          <TestDataBanner feed={data.feed} />
          <div className="mb-5">
            <FilterTabs base="/live-scores" active={filter} />
          </div>
          {(() => {
            const live = applyFilter(data.groups.live, filter);
            const next = applyFilter(data.groups.upcoming, filter).slice(0, 6);
            return (
              <>
                <h2 className="font-bold text-lg text-text mb-3">Live</h2>
                {live.length === 0 ? (
                  <EmptyState>No live matches for this filter right now.</EmptyState>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {live.map((m) => (
                      <MatchCard key={m.id} match={m} feed={data.feed} now={data.now} />
                    ))}
                  </div>
                )}
                <h2 className="font-bold text-lg text-text mt-8 mb-3">Next up</h2>
                {next.length === 0 ? (
                  <EmptyState>No upcoming matches for this filter.</EmptyState>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {next.map((m) => (
                      <MatchCard key={m.id} match={m} feed={data.feed} now={data.now} compact />
                    ))}
                  </div>
                )}
              </>
            );
          })()}
          <p className="mt-6 font-mono text-[11px] text-textFaint">{data.feed.refreshNote}. This page refreshes itself every minute while open. Times are IST.</p>
        </>
      )}
    </div>
  );
}
