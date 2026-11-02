import type { FeedInfo, Match, MatchDetail, Standings } from './types';
import { isLiveState } from './derive';
import { isVercelProduction } from '@/lib/v2/flags';

// Where the Sports pages read from. Pages never call a cricket provider
// directly: they read either labelled test data (local development) or
// Fyre's own Supabase tables, which only the scheduled sync job fills.
// So a traffic spike on match night costs no provider requests.
export interface CricketSource {
  id: string;
  label: string;
  isTestData: boolean;
  listMatches(now: Date): Promise<Match[]>;
  getMatch(now: Date, id: string): Promise<MatchDetail | null>;
  listStandings(now: Date): Promise<Standings[]>;
}

export class SportsUnavailableError extends Error {}

export async function getCricketSource(): Promise<CricketSource> {
  const choice = process.env.SPORTS_SOURCE ?? 'demo';
  if (choice === 'store') {
    const { storeSource } = await import('./providers/store');
    return storeSource;
  }
  if (choice === 'demo') {
    // Test data must never reach fyre.co.in.
    if (isVercelProduction()) throw new SportsUnavailableError('Test data is disabled in production');
    const { demoSource } = await import('./providers/demo');
    return demoSource;
  }
  throw new SportsUnavailableError(`Unknown SPORTS_SOURCE "${choice}"`);
}

export function feedInfo(source: CricketSource): FeedInfo {
  const minutes = Number(process.env.SPORTS_EXPECTED_REFRESH_MIN ?? 10);
  return {
    source: source.id,
    label: source.label,
    isTestData: source.isTestData,
    expectedRefreshMinutes: minutes,
    refreshNote: source.isTestData ? 'Test data: these are not real scores' : `Live scores refresh about every ${minutes} minutes`
  };
}

// --- grouping used by every Sports page ------------------------------------

export type MatchFilter = 'all' | 'india' | 'ipl' | 'international' | 'domestic';

export function applyFilter(matches: Match[], filter: MatchFilter): Match[] {
  switch (filter) {
    case 'india':
      return matches.filter((m) => m.teams.some((t) => t.isIndia));
    case 'ipl':
      return matches.filter((m) => m.competition.isIpl);
    case 'international':
      return matches.filter((m) => m.competition.kind === 'international');
    case 'domestic':
      return matches.filter((m) => m.competition.kind !== 'international' && !m.competition.isIpl);
    default:
      return matches;
  }
}

export function parseFilter(v: string | string[] | undefined): MatchFilter {
  const s = Array.isArray(v) ? v[0] : v;
  return s === 'india' || s === 'ipl' || s === 'international' || s === 'domestic' ? s : 'all';
}

// India first, then IPL, then by start time: the order Fyre's readers care about.
function priority(m: Match): number {
  if (m.teams.some((t) => t.isIndia)) return 0;
  if (m.competition.isIpl) return 1;
  return 2;
}

export function groupMatches(matches: Match[], now: Date) {
  const t = now.getTime();
  const live = matches.filter((m) => isLiveState(m.state)).sort((a, b) => priority(a) - priority(b) || Date.parse(a.startTime) - Date.parse(b.startTime));
  const upcoming = matches
    .filter((m) => m.state === 'scheduled' && Date.parse(m.startTime) >= t - 3_600_000)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  const results = matches
    .filter((m) => m.state === 'completed' || m.state === 'no_result' || m.state === 'abandoned')
    .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
  return { live, upcoming, results };
}
