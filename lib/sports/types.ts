// Provider-neutral cricket types. Every provider adapter (labelled test
// data, Highlightly, Fyre's own Supabase store) maps into these, so pages
// and components never see a provider's raw shape.
//
// Rule for every field: a value the provider did not send stays null. It is
// never filled with 0 or a guess -- the UI shows a dash instead.

export type Sport = 'cricket';

export type MatchFormat = 'TEST' | 'ODI' | 'T20I' | 'T20' | 'OTHER';

export type MatchState =
  | 'scheduled'
  | 'live'
  | 'innings_break'
  | 'stumps'
  | 'delayed'
  | 'completed'
  | 'abandoned'
  | 'no_result'
  | 'unknown';

export type CompetitionKind = 'international' | 'league' | 'domestic';

export interface Team {
  id: string;
  name: string;
  short: string;
  isIndia?: boolean;
}

export interface Competition {
  id: string;
  name: string;
  short: string;
  kind: CompetitionKind;
  season: string | null;
  isIpl?: boolean;
}

export interface InningsScore {
  teamId: string;
  runs: number | null;
  wickets: number | null;
  overs: string | null; // "18.2" -- overs.balls, as cricket writes it
  declared?: boolean;
  allOut?: boolean;
}

export interface Match {
  id: string; // Fyre's id: `${provider}:${providerId}`
  sport: Sport;
  provider: string;
  providerId: string;
  competition: Competition;
  format: MatchFormat;
  title: string; // "3rd T20I", "Match 41"
  startTime: string; // ISO
  venue: string | null;
  teams: [Team, Team];
  state: MatchState;
  statusText: string | null; // the provider's own status line
  innings: InningsScore[]; // in batting order
  target: number | null;
  oversLimit: number | null; // 20 / 50; null for Tests
  resultText: string | null;
  winnerTeamId: string | null;
  providerUpdatedAt: string | null;
  fetchedAt: string;
  isTestData: boolean;
}

export interface BattingRow {
  name: string;
  dismissal: string | null;
  runs: number | null;
  balls: number | null;
  fours: number | null;
  sixes: number | null;
}

export interface BowlingRow {
  name: string;
  overs: string | null;
  maidens: number | null;
  runs: number | null;
  wickets: number | null;
}

export interface InningsCard {
  number: number;
  teamId: string;
  score: InningsScore;
  batting: BattingRow[];
  bowling: BowlingRow[];
  extras: number | null;
  fallOfWickets: string | null;
}

export interface MatchDetail extends Match {
  toss: string | null;
  playerOfMatch: string | null;
  scorecard: InningsCard[];
}

export interface StandingRow {
  position: number;
  team: Team;
  played: number | null;
  won: number | null;
  lost: number | null;
  noResult: number | null;
  points: number | null;
  nrr: number | null;
}

export interface Standings {
  competition: Competition;
  rows: StandingRow[];
  updatedAt: string | null;
  isTestData: boolean;
}

// What the page tells the reader about where scores come from.
export interface FeedInfo {
  source: string; // "demo" | "store"
  label: string; // shown on the page
  isTestData: boolean;
  refreshNote: string; // "Scores refresh about every 10 minutes"
  expectedRefreshMinutes: number;
}
