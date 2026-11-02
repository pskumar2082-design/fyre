import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Match } from './types';
import { istDateKey, isLiveState } from './derive';
import { liveMinutesRemaining, liveScoresDue } from './budget';
import { createHighlightlyClient, type CallRecord } from './providers/highlightly';

// Scheduled cricket sync. NOT ACTIVE: it returns "skipped" unless
// SPORTS_SYNC_ENABLED=1 and HIGHLIGHTLY_API_KEY are both set, and neither
// is set in any environment. Turning it on is a separate approval.
//
// Called by /api/cron/cricket once a minute (scheduler chosen at the
// approval gate). Each run decides from the daily budget whether a provider
// call is due at all; most runs make none.

export const DAILY_LIMIT = Number(process.env.HIGHLIGHTLY_DAILY_LIMIT ?? 100);
const RESERVE = 8;
const MIN_INTERVAL_MIN = 5;
const FIXTURE_DAYS = 7;

export type CricketSyncReport = { skipped?: string; calls: number; livePolled: boolean; fixturesFetched: boolean; matchesWritten: number; decision?: string };

function istMidnight(now: Date): Date {
  return new Date(`${istDateKey(now)}T00:00:00+05:30`);
}

async function usedToday(now: Date): Promise<number> {
  const { count } = await supabaseAdmin.from('sp_call_log').select('id', { count: 'exact', head: true }).eq('provider', 'highlightly').gte('at', istMidnight(now).toISOString());
  return count ?? 0;
}

async function logCall(c: CallRecord) {
  await supabaseAdmin.from('sp_call_log').insert({ provider: 'highlightly', endpoint: c.endpoint, status: c.status, ms: c.ms, ok: c.ok, remaining: c.remaining });
}

async function feedStatus(feed: string, ok: boolean, error?: string) {
  const { data } = await supabaseAdmin.from('sp_feed_status').select('consecutive_failures').eq('feed', feed).maybeSingle();
  const now = new Date().toISOString();
  await supabaseAdmin.from('sp_feed_status').upsert(
    ok
      ? { feed, last_success: now, consecutive_failures: 0, updated_at: now }
      : { feed, last_error: now, error_text: (error ?? '').slice(0, 500), consecutive_failures: ((data as any)?.consecutive_failures ?? 0) + 1, updated_at: now },
    { onConflict: 'feed' }
  );
}

export function matchToRow(m: Match) {
  return {
    id: m.id,
    sport: m.sport,
    provider: m.provider,
    provider_id: m.providerId,
    competition_id: m.competition.id,
    format: m.format,
    title: m.title,
    start_time: m.startTime,
    venue: m.venue,
    teams: m.teams,
    state: m.state,
    status_text: m.statusText,
    innings: m.innings,
    target: m.target,
    overs_limit: m.oversLimit,
    result_text: m.resultText,
    winner_team_id: m.winnerTeamId,
    provider_updated_at: m.providerUpdatedAt,
    fetched_at: m.fetchedAt,
    source: m.provider
  };
}

async function writeMatches(matches: Match[]): Promise<number> {
  if (!matches.length) return 0;
  const comps = new Map(matches.map((m) => [m.competition.id, m.competition]));
  await supabaseAdmin.from('sp_competition').upsert(
    [...comps.values()].map((c) => ({ id: c.id, provider: 'highlightly', name: c.name, short: c.short, kind: c.kind, season: c.season, is_ipl: !!c.isIpl, updated_at: new Date().toISOString() })),
    { onConflict: 'id' }
  );
  const { error } = await supabaseAdmin.from('sp_match').upsert(matches.map(matchToRow), { onConflict: 'id' });
  if (error) throw new Error(`sp_match upsert: ${error.message}`);
  return matches.length;
}

export async function runCricketSync(now = new Date()): Promise<CricketSyncReport> {
  const report: CricketSyncReport = { calls: 0, livePolled: false, fixturesFetched: false, matchesWritten: 0 };
  if (process.env.SPORTS_SYNC_ENABLED !== '1') return { ...report, skipped: 'SPORTS_SYNC_ENABLED is not 1' };
  const apiKey = process.env.HIGHLIGHTLY_API_KEY;
  if (!apiKey) return { ...report, skipped: 'HIGHLIGHTLY_API_KEY is not set' };

  const client = createHighlightlyClient({
    apiKey,
    onCall: (c) => {
      report.calls += 1;
      void logCall(c);
    }
  });

  let used = await usedToday(now);
  const today = istDateKey(now);

  // 1. Fixtures for the next 7 days, once a day (7 calls).
  const { data: fx } = await supabaseAdmin.from('sp_feed_status').select('last_success').eq('feed', 'fixtures').maybeSingle();
  const fixturesDoneToday = (fx as any)?.last_success && istDateKey(new Date((fx as any).last_success)) === today;
  if (!fixturesDoneToday && used + FIXTURE_DAYS <= DAILY_LIMIT - RESERVE) {
    try {
      for (let i = 1; i <= FIXTURE_DAYS; i++) {
        const day = istDateKey(new Date(now.getTime() + i * 86_400_000));
        report.matchesWritten += await writeMatches(await client.matchesOn(day, now));
      }
      used += FIXTURE_DAYS;
      report.fixturesFetched = true;
      await feedStatus('fixtures', true);
    } catch (err: any) {
      await feedStatus('fixtures', false, err?.message);
    }
  }

  // 2. Live scores: today's list, when the budget says it is due.
  const endOfDay = new Date(istMidnight(now).getTime() + 86_400_000);
  const { data: todays } = await supabaseAdmin.from('sp_match').select('start_time, format, state').gte('start_time', new Date(istMidnight(now).getTime() - 12 * 3_600_000).toISOString()).lt('start_time', endOfDay.toISOString());
  const windows = (todays ?? []).map((r: any) => ({ startTime: r.start_time, format: r.format, finished: !(r.state === 'scheduled' || isLiveState(r.state)) }));
  const { data: lp } = await supabaseAdmin.from('sp_feed_status').select('last_success').eq('feed', 'live').maybeSingle();
  const decision = liveScoresDue({
    usedToday: used,
    dailyLimit: DAILY_LIMIT,
    reserve: RESERVE,
    minIntervalMin: MIN_INTERVAL_MIN,
    liveMinutesRemaining: liveMinutesRemaining(windows, now, endOfDay),
    lastLivePollAt: (lp as any)?.last_success ? new Date((lp as any).last_success) : null,
    now
  });
  report.decision = decision.reason;
  if (decision.due) {
    try {
      report.matchesWritten += await writeMatches(await client.matchesOn(today, now));
      report.livePolled = true;
      await feedStatus('live', true);
    } catch (err: any) {
      await feedStatus('live', false, err?.message);
    }
  }
  return report;
}
