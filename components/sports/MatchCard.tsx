import Link from 'next/link';
import type { FeedInfo, Match } from '@/lib/sports/types';
import { currentRunRate, feedFreshness, formatScore, istDay, istTime, isLiveState, requiredRunRate } from '@/lib/sports/derive';

const STATE_LABEL: Record<Match['state'], string> = {
  scheduled: 'Upcoming',
  live: 'Live',
  innings_break: 'Innings break',
  stumps: 'Stumps',
  delayed: 'Play delayed',
  completed: 'Result',
  abandoned: 'Abandoned',
  no_result: 'No result',
  unknown: 'Status unknown'
};

export function formatLabel(m: Match): string {
  return m.competition.isIpl ? 'IPL' : m.format === 'TEST' ? 'Test' : m.format === 'OTHER' ? m.competition.short : m.format;
}

// Live / upcoming / result card. Every number comes from the feed; the only
// calculated values (run rates) are labelled as calculated and appear only
// when every input is present.
export default function MatchCard({ match, feed, now, compact = false }: { match: Match; feed: FeedInfo; now: Date; compact?: boolean }) {
  const live = isLiveState(match.state);
  const fresh = feedFreshness(match, now, Math.max(25, feed.expectedRefreshMinutes * 2 + 5));
  const delayed = fresh === 'delayed';
  const chasing = match.innings.length > 0 ? match.innings[match.innings.length - 1] : null;
  const rrr = live && match.oversLimit ? requiredRunRate({ target: match.target, runs: chasing?.runs ?? null, overs: chasing?.overs ?? null, oversLimit: match.oversLimit }) : null;
  const crr = live && chasing ? currentRunRate(chasing) : null;

  const tone = delayed ? 'border-amber/70' : live ? 'border-gold/60' : 'border-border';
  return (
    <Link
      href={`/sports/cricket/match/${encodeURIComponent(match.id)}`}
      className={`group block rounded-xl border ${tone} bg-surface hover:bg-surface2/60 hover:border-borderStrong transition-colors ${compact ? 'p-4' : 'p-4 sm:p-5'}`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider text-textDim min-w-0">
          {live && <span className={`w-2 h-2 rounded-full flex-none ${delayed ? 'bg-amber' : 'bg-red animate-pulse'}`} />}
          <span className={live ? 'text-text' : ''}>{STATE_LABEL[match.state]}</span>
          <span className="text-textFaint">·</span>
          <span className="truncate">{formatLabel(match)} · {match.title}</span>
        </span>
        {match.isTestData && <span className="flex-none font-mono text-[10px] font-bold uppercase tracking-wider text-black bg-amber rounded px-1.5 py-0.5">Test data</span>}
      </div>

      <div className="space-y-1.5">
        {match.teams.map((t) => {
          const inns = match.innings.filter((i) => i.teamId === t.id);
          const won = match.winnerTeamId === t.id;
          return (
            <div key={t.id} className="flex items-baseline justify-between gap-3">
              <span className={`truncate text-[15px] sm:text-base ${won ? 'font-bold text-text' : 'font-semibold text-text'}`}>{t.name}</span>
              <span className="font-mono text-[15px] sm:text-base font-bold text-text whitespace-nowrap">
                {inns.length === 0 ? (
                  <span className="text-textFaint font-normal">{match.state === 'scheduled' ? '' : 'Yet to bat'}</span>
                ) : (
                  inns.map((i, k) => (
                    <span key={k}>
                      {k > 0 && <span className="text-textFaint font-normal"> & </span>}
                      {formatScore(i)}
                      {i.overs && match.format !== 'TEST' && <span className="text-textDim font-normal text-[13px]"> ({i.overs})</span>}
                    </span>
                  ))
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[13px] sm:text-sm text-textDim min-h-[20px]">
        {match.state === 'scheduled' ? (
          <span>
            {istDay(match.startTime)}, {istTime(match.startTime)} IST{match.venue ? ` · ${match.venue}` : ''}
          </span>
        ) : match.resultText ? (
          <span className="text-text">{match.resultText}</span>
        ) : (
          <span className="text-text">{match.statusText ?? '–'}</span>
        )}
      </div>

      {(rrr || crr != null) && !compact && (
        <div className="mt-2 font-mono text-xs text-textDim">
          {crr != null && <span>CRR {crr.toFixed(2)}</span>}
          {rrr && (
            <span>
              {crr != null && ' · '}Need {rrr.runsNeeded} off {rrr.ballsLeft} · RRR {rrr.rate.toFixed(2)}
            </span>
          )}
          <span className="text-textFaint"> (calculated)</span>
        </div>
      )}

      {(live || match.state === 'completed') && (
        <div className={`mt-3 pt-3 border-t border-surface2 font-mono text-[11px] sm:text-xs ${delayed ? 'text-amber font-bold' : 'text-textFaint'}`}>
          {delayed ? `Delayed: last update ${istTime(match.providerUpdatedAt ?? match.fetchedAt)} IST` : `Updated ${istTime(match.providerUpdatedAt ?? match.fetchedAt)} IST${live && !match.isTestData ? ` · every ~${feed.expectedRefreshMinutes} min` : ''}`}
        </div>
      )}
    </Link>
  );
}
