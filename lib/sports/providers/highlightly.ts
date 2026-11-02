import type { Competition, CompetitionKind, InningsScore, Match, MatchFormat, MatchState, Team } from '../types';
import { parseOversInfo, parseScore } from '../derive';

// Highlightly Cricket API adapter (https://highlightly.net/cricket-api/).
//
// STATUS: NOT ACTIVE. Used only by the scheduled sync job, and only when
// SPORTS_SYNC_ENABLED=1 and HIGHLIGHTLY_API_KEY are set -- neither is set
// anywhere yet. Before it is switched on we still need Highlightly's written
// confirmation that the free BASIC plan may be shown on a public,
// ad-supported site, and the field mapping below must be checked against a
// real response during the approved trial. It was written from the public
// documentation, which shows list results with score strings such as
// "139/4" and an info string such as "17.2/20 ov, T:138"; anything the
// mapper cannot read is left null, never guessed.

export const HIGHLIGHTLY_BASE = 'https://cricket.highlightly.net';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type CallRecord = { endpoint: string; status: number; ms: number; ok: boolean; remaining: number | null };

export function createHighlightlyClient(opts: { apiKey: string; fetch?: FetchLike; onCall?: (c: CallRecord) => void; authHeader?: string }) {
  const doFetch = opts.fetch ?? fetch;
  const header = opts.authHeader ?? process.env.HIGHLIGHTLY_AUTH_HEADER ?? 'x-rapidapi-key';

  async function get(path: string, params: Record<string, string>): Promise<any> {
    const url = `${HIGHLIGHTLY_BASE}${path}?${new URLSearchParams(params)}`;
    const t0 = Date.now();
    let res: Response;
    try {
      res = await doFetch(url, { headers: { [header]: opts.apiKey, accept: 'application/json' }, cache: 'no-store' } as RequestInit);
    } catch (err) {
      opts.onCall?.({ endpoint: path, status: 0, ms: Date.now() - t0, ok: false, remaining: null });
      throw err;
    }
    const remaining = Number(res.headers.get('x-ratelimit-requests-remaining'));
    opts.onCall?.({ endpoint: path, status: res.status, ms: Date.now() - t0, ok: res.ok, remaining: Number.isFinite(remaining) ? remaining : null });
    if (!res.ok) throw new Error(`Highlightly ${path}: HTTP ${res.status}`);
    return res.json();
  }

  return {
    // One call returns every match on an IST date, live ones included.
    async matchesOn(dateIst: string, now: Date): Promise<Match[]> {
      const body = await get('/matches', { date: dateIst, timezone: 'Asia/Kolkata', limit: '100' });
      const list: any[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
      return list.map((raw) => mapHighlightlyMatch(raw, now)).filter((m): m is Match => m != null);
    },
    async matchById(id: string): Promise<any> {
      return get(`/matches/${encodeURIComponent(id)}`, {});
    },
    async standings(leagueId: string, season: string): Promise<any> {
      return get('/standings', { leagueId, season });
    }
  };
}

const IPL_RE = /indian premier league|\bipl\b/i;

function formatOf(raw: any, leagueName: string): MatchFormat {
  const s = `${raw?.format ?? ''} ${raw?.matchType ?? ''} ${leagueName}`.toLowerCase();
  if (/\btest\b/.test(s)) return 'TEST';
  if (/\bodi\b|one[- ]day international/.test(s)) return 'ODI';
  if (/\bt20i\b|twenty20 international/.test(s)) return 'T20I';
  if (/t20|twenty20|premier league/.test(s)) return 'T20';
  return 'OTHER';
}

function stateOf(desc: string): MatchState {
  const s = desc.toLowerCase();
  if (/not started|scheduled|upcoming/.test(s)) return 'scheduled';
  if (/innings break/.test(s)) return 'innings_break';
  if (/stumps/.test(s)) return 'stumps';
  if (/delay|rain|interrupted/.test(s) && !/finished|result/.test(s)) return 'delayed';
  if (/no result/.test(s)) return 'no_result';
  if (/abandon/.test(s)) return 'abandoned';
  if (/finished|completed|won|ended|result/.test(s)) return 'completed';
  if (/live|in progress|play/.test(s)) return 'live';
  return 'unknown';
}

function team(raw: any, fallback: string): Team {
  const name = String(raw?.name ?? fallback);
  return { id: String(raw?.id ?? name.toLowerCase().replace(/\W+/g, '-')), name, short: String(raw?.abbreviation ?? raw?.shortName ?? name.slice(0, 3).toUpperCase()), isIndia: /^india$/i.test(name) };
}

// Maps one list entry. Returns null when the entry has no id or no teams.
export function mapHighlightlyMatch(raw: any, now: Date): Match | null {
  if (!raw || raw.id == null) return null;
  const home = raw.homeTeam ?? raw.teams?.home;
  const away = raw.awayTeam ?? raw.teams?.away;
  if (!home || !away) return null;
  const leagueName = String(raw.league?.name ?? raw.competition?.name ?? 'Cricket');
  const kind: CompetitionKind = /international|t20i|odi|test|world cup|icc/i.test(leagueName) ? 'international' : IPL_RE.test(leagueName) ? 'league' : 'domestic';
  const competition: Competition = {
    id: `highlightly:${raw.league?.id ?? leagueName}`,
    name: leagueName,
    short: IPL_RE.test(leagueName) ? 'IPL' : leagueName,
    kind,
    season: raw.league?.season != null ? String(raw.league.season) : null,
    isIpl: IPL_RE.test(leagueName)
  };
  const tHome = team(home, 'Home');
  const tAway = team(away, 'Away');

  // Score strings live under state.teams.{home,away}.{score,info} in the
  // documented example; both are optional.
  const innings: InningsScore[] = [];
  let target: number | null = null;
  let oversLimit: number | null = null;
  for (const [side, t] of [['home', tHome], ['away', tAway]] as const) {
    const s = raw.state?.teams?.[side] ?? raw[`${side}Score`];
    if (!s) continue;
    const sc = parseScore(s.score ?? s);
    const info = parseOversInfo(s.info ?? null);
    if (sc.runs == null) continue;
    innings.push({ teamId: t.id, runs: sc.runs, wickets: sc.wickets, overs: info.overs, declared: sc.declared, allOut: sc.allOut });
    if (info.target != null) target = info.target;
    if (info.oversLimit != null) oversLimit = info.oversLimit;
  }
  const desc = String(raw.state?.description ?? raw.status ?? '');
  const format = formatOf(raw, leagueName);
  return {
    id: `highlightly:${raw.id}`,
    sport: 'cricket',
    provider: 'highlightly',
    providerId: String(raw.id),
    competition,
    format,
    title: String(raw.round ?? raw.name ?? ''),
    startTime: String(raw.startTime ?? raw.date ?? now.toISOString()),
    venue: raw.venue?.name ?? null,
    teams: [tHome, tAway],
    state: stateOf(desc),
    statusText: raw.state?.report ?? null,
    innings,
    target,
    oversLimit: oversLimit ?? (format === 'T20I' || format === 'T20' ? 20 : format === 'ODI' ? 50 : null),
    resultText: /won|tied|no result|abandon/i.test(String(raw.state?.report ?? '')) ? String(raw.state.report) : null,
    winnerTeamId: null,
    providerUpdatedAt: raw.state?.updatedAt ?? null,
    fetchedAt: now.toISOString(),
    isTestData: false
  };
}
