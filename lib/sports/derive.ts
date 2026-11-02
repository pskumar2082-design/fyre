import type { InningsScore, Match } from './types';

// Pure helpers that read cricket values. None of them invents a number:
// when an input is missing the result is null, and the UI shows a dash.

// "139/4" -> { runs: 139, wickets: 4 }; "275" -> { runs: 275, wickets: null,
// allOut: true }; "312/7d" -> declared. Anything else -> nulls.
export function parseScore(text: string | null | undefined): { runs: number | null; wickets: number | null; declared: boolean; allOut: boolean } {
  const empty = { runs: null, wickets: null, declared: false, allOut: false };
  if (!text) return empty;
  const m = String(text).trim().match(/^(\d{1,3})(?:\s*[/-]\s*(\d{1,2}))?\s*(d|dec)?$/i);
  if (!m) return empty;
  const runs = Number(m[1]);
  const wickets = m[2] != null ? Number(m[2]) : null;
  if (wickets != null && wickets > 10) return empty;
  return { runs, wickets, declared: !!m[3], allOut: m[2] == null && !m[3] };
}

// "17.2/20 ov, T:138" -> { overs: "17.2", oversLimit: 20, target: 138 }
// "45.3 ov" -> { overs: "45.3", oversLimit: null, target: null }
export function parseOversInfo(text: string | null | undefined): { overs: string | null; oversLimit: number | null; target: number | null } {
  const out = { overs: null as string | null, oversLimit: null as number | null, target: null as number | null };
  if (!text) return out;
  const s = String(text);
  const ov = s.match(/(\d{1,3}(?:\.[0-5])?)\s*(?:\/\s*(\d{1,3}))?\s*ov/i);
  if (ov) {
    out.overs = ov[1];
    out.oversLimit = ov[2] != null ? Number(ov[2]) : null;
  }
  const t = s.match(/T\s*:\s*(\d{1,3})/i);
  if (t) out.target = Number(t[1]);
  return out;
}

// "17.2" -> 104 balls. Invalid ball counts (".6" and above) -> null.
export function oversToBalls(overs: string | null | undefined): number | null {
  if (overs == null || overs === '') return null;
  const m = String(overs).match(/^(\d{1,3})(?:\.([0-5]))?$/);
  if (!m) return null;
  return Number(m[1]) * 6 + (m[2] != null ? Number(m[2]) : 0);
}

export function currentRunRate(score: Pick<InningsScore, 'runs' | 'overs'>): number | null {
  const balls = oversToBalls(score.overs);
  if (score.runs == null || balls == null || balls === 0) return null;
  return round2((score.runs * 6) / balls);
}

// Required run rate for the side batting second in a limited-overs match.
// Needs the target, the runs, the overs faced and the overs limit -- all
// four from the provider. Returns null otherwise, or once the chase is over.
export function requiredRunRate(input: { target: number | null; runs: number | null; overs: string | null; oversLimit: number | null }): { runsNeeded: number; ballsLeft: number; rate: number } | null {
  const { target, runs, overs, oversLimit } = input;
  if (target == null || runs == null || oversLimit == null) return null;
  const faced = oversToBalls(overs);
  if (faced == null) return null;
  const ballsLeft = oversLimit * 6 - faced;
  const runsNeeded = target - runs;
  if (ballsLeft <= 0 || runsNeeded <= 0) return null;
  return { runsNeeded, ballsLeft, rate: round2((runsNeeded * 6) / ballsLeft) };
}

export function isLiveState(state: Match['state']): boolean {
  return state === 'live' || state === 'innings_break' || state === 'stumps' || state === 'delayed';
}

// A live score is "delayed" when its last provider update is older than the
// threshold (default 25 minutes: twice the expected ~10-minute refresh on
// the free plan, plus margin). Finished or upcoming matches never are.
export function feedFreshness(match: Pick<Match, 'state' | 'providerUpdatedAt' | 'fetchedAt'>, now: Date, thresholdMinutes = 25): 'fresh' | 'delayed' | 'not_live' {
  if (!isLiveState(match.state)) return 'not_live';
  const stamp = match.providerUpdatedAt ?? match.fetchedAt;
  const t = Date.parse(stamp);
  if (Number.isNaN(t)) return 'delayed';
  return now.getTime() - t > thresholdMinutes * 60_000 ? 'delayed' : 'fresh';
}

export function formatScore(s: InningsScore | undefined | null): string {
  if (!s || s.runs == null) return '–';
  if (s.declared) return `${s.runs}/${s.wickets ?? '?'}d`;
  if (s.wickets == null || s.wickets === 10) return String(s.runs);
  return `${s.runs}/${s.wickets}`;
}

// Times on Fyre are shown in IST.
export function istTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function istDay(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
}

export function istDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
