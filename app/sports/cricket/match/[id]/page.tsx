import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { sportsEnabled } from '@/lib/v2/flags';
import { loadMatch } from '@/lib/sports/load';
import { formatScore, istDay, istTime } from '@/lib/sports/derive';
import { SITE_URL } from '@/lib/siteConfig';
import { EmptyState } from '@/components/ui';
import MatchCard from '@/components/sports/MatchCard';
import { Panel, TestDataBanner } from '@/components/sports/SportsBits';
import AutoRefresh from '@/components/sports/AutoRefresh';
import type { InningsCard, MatchDetail } from '@/lib/sports/types';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  if (!sportsEnabled()) return {};
  const r = await loadMatch(decodeURIComponent(params.id));
  if (!r.ok || !r.match) return { title: 'Match' };
  const m = r.match;
  return {
    title: `${m.teams[0].name} vs ${m.teams[1].name}, ${m.title}`,
    description: `${m.competition.name}: scorecard and match status.`,
    alternates: { canonical: `${SITE_URL}/sports/cricket/match/${encodeURIComponent(m.id)}` },
    robots: m.isTestData ? { index: false, follow: false } : undefined
  };
}

function teamName(m: MatchDetail, id: string) {
  return m.teams.find((t) => t.id === id)?.name ?? id;
}

function InningsTable({ inn, match }: { inn: InningsCard; match: MatchDetail }) {
  const num = 'px-2 py-1.5 text-right font-mono';
  return (
    <Panel title={`${teamName(match, inn.teamId)} · ${formatScore(inn.score)}${inn.score.overs ? ` (${inn.score.overs} ov)` : ''}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-textFaint">
              <th className="px-2 py-1.5 text-left font-normal">Batter</th>
              <th className="px-2 py-1.5 text-left font-normal hidden sm:table-cell">Dismissal</th>
              <th className={`${num} font-normal`}>R</th>
              <th className={`${num} font-normal`}>B</th>
              <th className={`${num} font-normal`}>4s</th>
              <th className={`${num} font-normal`}>6s</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface2">
            {inn.batting.map((b) => (
              <tr key={b.name}>
                <td className="px-2 py-1.5 text-text">
                  {b.name}
                  <span className="block sm:hidden text-xs text-textFaint">{b.dismissal ?? ''}</span>
                </td>
                <td className="px-2 py-1.5 text-textDim hidden sm:table-cell">{b.dismissal ?? '–'}</td>
                <td className={`${num} font-bold text-text`}>{b.runs ?? '–'}</td>
                <td className={num}>{b.balls ?? '–'}</td>
                <td className={num}>{b.fours ?? '–'}</td>
                <td className={num}>{b.sixes ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-2 pt-2 text-xs text-textDim">
          Extras {inn.extras ?? '–'}
          {inn.fallOfWickets ? ` · Fall of wickets: ${inn.fallOfWickets}` : ''}
        </p>
        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="text-xs text-textFaint">
              <th className="px-2 py-1.5 text-left font-normal">Bowler</th>
              <th className={`${num} font-normal`}>O</th>
              <th className={`${num} font-normal`}>M</th>
              <th className={`${num} font-normal`}>R</th>
              <th className={`${num} font-normal`}>W</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface2">
            {inn.bowling.map((b) => (
              <tr key={b.name}>
                <td className="px-2 py-1.5 text-text">{b.name}</td>
                <td className={num}>{b.overs ?? '–'}</td>
                <td className={num}>{b.maidens ?? '–'}</td>
                <td className={num}>{b.runs ?? '–'}</td>
                <td className={`${num} font-bold text-text`}>{b.wickets ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default async function MatchPage({ params }: { params: { id: string } }) {
  if (!sportsEnabled()) notFound();
  const r = await loadMatch(decodeURIComponent(params.id));
  if (!r.ok) {
    return (
      <div className="fx-container py-8 sm:py-12 max-w-4xl">
        <EmptyState>This match is unavailable right now.</EmptyState>
      </div>
    );
  }
  const m = r.match;
  if (!m) notFound();

  return (
    <div className="fx-container py-8 sm:py-12 max-w-4xl">
      <AutoRefresh seconds={60} />
      <Link href="/sports" className="inline-flex items-center gap-2 text-sm text-textDim hover:text-white mb-5">
        <ArrowLeft className="w-4 h-4" /> Sports
      </Link>
      <TestDataBanner feed={r.feed} />
      <h1 className="hdisplay font-extrabold text-2xl sm:text-3xl text-text mb-1">
        {m.teams[0].name} vs {m.teams[1].name}
      </h1>
      <p className="font-mono text-sm text-textDim mb-5">
        {m.competition.name} · {m.title} · {istDay(m.startTime)}, {istTime(m.startTime)} IST{m.venue ? ` · ${m.venue}` : ''}
      </p>
      <MatchCard match={m} feed={r.feed} now={r.now} />
      <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-xs text-textFaint mb-1">Toss</div>
          <div className="text-text">{m.toss ?? 'Not reported'}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="text-xs text-textFaint mb-1">Player of the match</div>
          <div className="text-text">{m.playerOfMatch ?? (m.state === 'completed' ? 'Not reported' : 'After the match')}</div>
        </div>
      </div>
      <h2 className="font-bold text-xl text-text mt-8 mb-3">Scorecard</h2>
      {m.scorecard.length === 0 ? (
        <EmptyState>{m.state === 'scheduled' ? 'The scorecard starts when the match does.' : 'A full scorecard is not available for this match yet.'}</EmptyState>
      ) : (
        <div className="space-y-4">
          {m.scorecard.map((inn) => (
            <InningsTable key={inn.number} inn={inn} match={m} />
          ))}
        </div>
      )}
      <p className="mt-6 font-mono text-[11px] text-textFaint">Ball-by-ball commentary is not included while Fyre uses a free data plan.</p>
    </div>
  );
}
