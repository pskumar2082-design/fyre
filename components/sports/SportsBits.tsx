import Link from 'next/link';
import { FlaskConical } from 'lucide-react';
import type { FeedInfo, Match, Standings } from '@/lib/sports/types';
import type { MatchFilter } from '@/lib/sports/source';
import { formatScore, istDay, istTime } from '@/lib/sports/derive';
import { formatLabel } from './MatchCard';

// Shown at the top of every Sports page while the source is test data.
export function TestDataBanner({ feed }: { feed: FeedInfo }) {
  if (!feed.isTestData) return null;
  return (
    <div role="note" className="mb-6 rounded-xl border border-amber/60 bg-amber/10 px-4 py-3 flex items-start gap-3">
      <FlaskConical className="w-5 h-5 text-amber flex-none mt-0.5" strokeWidth={2} />
      <div className="text-sm">
        <p className="font-bold text-text">Test data: these are not real scores</p>
        <p className="text-textDim mt-0.5">
          Teams, players and numbers on this page are made up to test the design. Real scores appear only after a licensed live feed is approved.
        </p>
      </div>
    </div>
  );
}

export const FILTERS: { key: MatchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'india', label: 'India' },
  { key: 'ipl', label: 'IPL' },
  { key: 'international', label: 'International' },
  { key: 'domestic', label: 'Domestic' }
];

export function FilterTabs({ base, active, extra = '' }: { base: string; active: MatchFilter; extra?: string }) {
  return (
    <nav aria-label="Filter matches" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {FILTERS.map((f) => (
        <Link
          key={f.key}
          href={f.key === 'all' ? `${base}${extra ? `?${extra}` : ''}` : `${base}?filter=${f.key}${extra ? `&${extra}` : ''}`}
          aria-current={f.key === active ? 'page' : undefined}
          className={`inline-flex items-center h-9 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap border transition-colors ${
            f.key === active ? 'bg-white text-black border-white' : 'bg-surface border-border text-textDim hover:text-white hover:border-borderStrong'
          }`}
        >
          {f.label}
        </Link>
      ))}
    </nav>
  );
}

export function FixtureList({ matches, empty = 'No fixtures in the next 7 days.' }: { matches: Match[]; empty?: string }) {
  if (!matches.length) return <p className="text-sm text-textFaint px-1 py-4">{empty}</p>;
  return (
    <ul className="divide-y divide-surface2">
      {matches.map((m) => (
        <li key={m.id}>
          <Link href={`/sports/cricket/match/${encodeURIComponent(m.id)}`} className="flex items-center gap-3 py-3 px-1 hover:bg-surface2/40 rounded-lg">
            <span className="w-24 sm:w-28 flex-none font-mono text-xs text-textDim">
              {istDay(m.startTime)}
              <br />
              {istTime(m.startTime)} IST
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-text text-[15px]">
                {m.teams[0].name} vs {m.teams[1].name}
              </span>
              <span className="block truncate text-xs text-textFaint font-mono">
                {formatLabel(m)} · {m.title}
                {m.venue ? ` · ${m.venue}` : ''}
              </span>
            </span>
            {m.isTestData && <span className="flex-none font-mono text-[10px] font-bold uppercase text-amber">Test</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ResultList({ matches }: { matches: Match[] }) {
  if (!matches.length) return <p className="text-sm text-textFaint px-1 py-4">No results in the last few days.</p>;
  return (
    <ul className="divide-y divide-surface2">
      {matches.map((m) => (
        <li key={m.id}>
          <Link href={`/sports/cricket/match/${encodeURIComponent(m.id)}`} className="block py-3 px-1 hover:bg-surface2/40 rounded-lg">
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate font-semibold text-text text-[15px]">{m.resultText ?? 'Result pending'}</span>
              <span className="flex-none font-mono text-xs text-textFaint">{istDay(m.startTime)}</span>
            </span>
            <span className="block truncate text-xs text-textDim font-mono mt-0.5">
              {m.teams.map((t) => `${t.short} ${m.innings.filter((i) => i.teamId === t.id).map(formatScore).join(' & ') || '–'}`).join('  ·  ')}
              {'  ·  '}
              {formatLabel(m)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StandingsTable({ standings }: { standings: Standings }) {
  const cell = 'px-2 py-2 text-right font-mono';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-textFaint text-xs">
            <th className="px-2 py-2 text-left font-normal">Team</th>
            <th className={`${cell} font-normal`}>P</th>
            <th className={`${cell} font-normal`}>W</th>
            <th className={`${cell} font-normal`}>L</th>
            <th className={`${cell} font-normal`}>NR</th>
            <th className={`${cell} font-normal`}>NRR</th>
            <th className={`${cell} font-normal`}>Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface2">
          {standings.rows.map((r) => (
            <tr key={r.team.id}>
              <td className="px-2 py-2 text-text whitespace-nowrap">
                <span className="font-mono text-textFaint mr-2">{r.position}</span>
                {r.team.name}
              </td>
              <td className={cell}>{r.played ?? '–'}</td>
              <td className={cell}>{r.won ?? '–'}</td>
              <td className={cell}>{r.lost ?? '–'}</td>
              <td className={cell}>{r.noResult ?? '–'}</td>
              <td className={cell}>{r.nrr == null ? '–' : `${r.nrr > 0 ? '+' : ''}${r.nrr.toFixed(2)}`}</td>
              <td className={`${cell} font-bold text-text`}>{r.points ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 px-2 font-mono text-[11px] text-textFaint">
        Updated {istDay(standings.updatedAt)} {istTime(standings.updatedAt)} IST{standings.isTestData ? ' · test data' : ''}
      </p>
    </div>
  );
}

export function Panel({ title, action, children, className = '' }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-surface p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="font-bold text-lg text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
