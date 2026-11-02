import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { sportsEnabled } from '@/lib/v2/flags';
import { loadSports } from '@/lib/sports/load';
import { applyFilter, parseFilter } from '@/lib/sports/source';
import { SITE_URL } from '@/lib/siteConfig';
import { SectionHeading, EmptyState } from '@/components/ui';
import { FilterTabs, FixtureList, Panel, ResultList, StandingsTable, TestDataBanner } from '@/components/sports/SportsBits';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Cricket fixtures, results and points tables',
  description: 'Upcoming cricket fixtures, recent results and points tables for India, the IPL and international cricket.',
  alternates: { canonical: `${SITE_URL}/sports/cricket` }
};

const TABS = [
  { key: 'fixtures', label: 'Fixtures' },
  { key: 'results', label: 'Results' },
  { key: 'tables', label: 'Points tables' }
] as const;

export default async function CricketPage({ searchParams }: { searchParams: { tab?: string; filter?: string } }) {
  if (!sportsEnabled()) notFound();
  const tab = TABS.find((t) => t.key === searchParams.tab)?.key ?? 'fixtures';
  const filter = parseFilter(searchParams.filter);
  const data = await loadSports();

  return (
    <div className="fx-container py-8 sm:py-12 max-w-5xl">
      <SectionHeading title="Cricket" subtitle="Fixtures, results and points tables" />
      {!data.ok ? (
        <EmptyState>Cricket data is unavailable right now.</EmptyState>
      ) : (
        <>
          <TestDataBanner feed={data.feed} />
          <nav aria-label="Cricket sections" className="flex gap-6 border-b border-border mb-5">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={`/sports/cricket?tab=${t.key}${filter !== 'all' ? `&filter=${filter}` : ''}`}
                aria-current={t.key === tab ? 'page' : undefined}
                className={`pb-3 -mb-px border-b-[3px] text-sm font-semibold ${t.key === tab ? 'text-gold border-gold' : 'text-textFaint border-transparent hover:text-white'}`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          {tab !== 'tables' && (
            <div className="mb-4">
              <FilterTabs base="/sports/cricket" active={filter} extra={`tab=${tab}`} />
            </div>
          )}
          {tab === 'fixtures' && (
            <Panel title="Next 7 days">
              <FixtureList matches={applyFilter(data.groups.upcoming, filter)} empty="No fixtures for this filter in the next 7 days." />
            </Panel>
          )}
          {tab === 'results' && (
            <Panel title="Recent results">
              <ResultList matches={applyFilter(data.groups.results, filter)} />
            </Panel>
          )}
          {tab === 'tables' &&
            (data.standings.length === 0 ? (
              <EmptyState>No points tables yet.</EmptyState>
            ) : (
              <div className="space-y-4">
                {data.standings.map((s) => (
                  <Panel key={s.competition.id} title={`${s.competition.name}${s.competition.season ? ` ${s.competition.season}` : ''}`}>
                    <StandingsTable standings={s} />
                  </Panel>
                ))}
              </div>
            ))}
        </>
      )}
    </div>
  );
}
