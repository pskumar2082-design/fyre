import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { sportsEnabled } from '@/lib/v2/flags';
import { loadSports } from '@/lib/sports/load';
import { SITE_URL } from '@/lib/siteConfig';
import { SectionHeading, EmptyState } from '@/components/ui';
import MatchCard from '@/components/sports/MatchCard';
import { FixtureList, Panel, ResultList, StandingsTable, TestDataBanner } from '@/components/sports/SportsBits';
import AutoRefresh from '@/components/sports/AutoRefresh';
import { publicArticles } from '@/lib/newsroom/public';
import ArticleCard from '@/components/newsroom/ArticleCard';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Sports: live cricket scores, fixtures and results',
  description: 'Live cricket scores for India, the IPL, Tests, ODIs and T20Is, with fixtures, results, scorecards and points tables.',
  alternates: { canonical: `${SITE_URL}/sports` }
};

export default async function SportsHub() {
  if (!sportsEnabled()) notFound();
  const data = await loadSports();
  const news = await publicArticles({ tag: 'cricket', limit: 4 }).catch(() => []);

  return (
    <div className="fx-container py-8 sm:py-12">
      <AutoRefresh seconds={60} />
      <SectionHeading title="Sports" subtitle="Cricket first: India, IPL, Tests, ODIs and T20Is" />
      {!data.ok ? (
        <EmptyState>Live cricket is unavailable right now. Scores will return as soon as the feed is back.</EmptyState>
      ) : (
        <>
          <TestDataBanner feed={data.feed} />
          <div className="flex items-end justify-between gap-3 mb-4">
            <h2 className="font-bold text-xl text-text">Live now</h2>
            <Link href="/live-scores" className="text-sm font-semibold text-zinc-300 hover:text-white">
              All live scores
            </Link>
          </div>
          {data.groups.live.length === 0 && data.groups.upcoming.length === 0 ? (
            <EmptyState>No live or upcoming matches right now.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[...data.groups.live, ...data.groups.upcoming.slice(0, Math.max(0, 3 - data.groups.live.length))].slice(0, 6).map((m) => (
                <MatchCard key={m.id} match={m} feed={data.feed} now={data.now} />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
            <Panel title="Upcoming fixtures" action={<Link href="/sports/cricket?tab=fixtures" className="text-sm text-textDim hover:text-white">All fixtures</Link>}>
              <FixtureList matches={data.groups.upcoming.slice(0, 5)} />
            </Panel>
            <Panel title="Recent results" action={<Link href="/sports/cricket?tab=results" className="text-sm text-textDim hover:text-white">All results</Link>}>
              <ResultList matches={data.groups.results.slice(0, 5)} />
            </Panel>
            {data.standings[0] && (
              <Panel title={`Points table · ${data.standings[0].competition.short}`} action={<Link href="/sports/cricket?tab=tables" className="text-sm text-textDim hover:text-white">All tables</Link>}>
                <StandingsTable standings={data.standings[0]} />
              </Panel>
            )}
            <Panel title="Cricket news">
              {news.length === 0 ? (
                <p className="text-sm text-textFaint py-4">Fyre&apos;s cricket stories will appear here.</p>
              ) : (
                <div className="divide-y divide-surface2">
                  {news.map((a) => (
                    <ArticleCard key={a.id} article={a} variant="row" />
                  ))}
                </div>
              )}
            </Panel>
          </div>
          <p className="mt-6 font-mono text-[11px] text-textFaint">{data.feed.refreshNote}. Times are IST.</p>
        </>
      )}
    </div>
  );
}
