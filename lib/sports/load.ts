import { feedInfo, getCricketSource, groupMatches, SportsUnavailableError } from './source';
import type { FeedInfo, Match, MatchDetail, Standings } from './types';

export type SportsData = { ok: true; feed: FeedInfo; now: Date; matches: Match[]; standings: Standings[]; groups: ReturnType<typeof groupMatches> } | { ok: false; now: Date; reason: string };

// One read for a Sports page. A source failure renders an "unavailable"
// state rather than an error page, and never shows stale numbers as new.
export async function loadSports(): Promise<SportsData> {
  const now = new Date();
  try {
    const source = await getCricketSource();
    const [matches, standings] = await Promise.all([source.listMatches(now), source.listStandings(now)]);
    return { ok: true, feed: feedInfo(source), now, matches, standings, groups: groupMatches(matches, now) };
  } catch (err: any) {
    if (!(err instanceof SportsUnavailableError)) console.error('loadSports:', err?.message ?? err);
    return { ok: false, now, reason: err instanceof SportsUnavailableError ? err.message : 'The cricket feed could not be read' };
  }
}

export async function loadMatch(id: string): Promise<{ ok: true; feed: FeedInfo; now: Date; match: MatchDetail | null } | { ok: false; now: Date; reason: string }> {
  const now = new Date();
  try {
    const source = await getCricketSource();
    return { ok: true, feed: feedInfo(source), now, match: await source.getMatch(now, id) };
  } catch (err: any) {
    return { ok: false, now, reason: err?.message ?? 'The cricket feed could not be read' };
  }
}
