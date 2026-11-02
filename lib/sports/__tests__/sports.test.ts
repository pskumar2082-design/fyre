import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentRunRate, feedFreshness, formatScore, oversToBalls, parseOversInfo, parseScore, requiredRunRate } from '../derive';
import { liveMinutesRemaining, liveScoresDue } from '../budget';
import { applyFilter, getCricketSource, groupMatches, parseFilter, SportsUnavailableError } from '../source';
import { demoMatchDetail, demoMatches, demoStandings } from '../providers/demo';
import { mapHighlightlyMatch, createHighlightlyClient } from '../providers/highlightly';
import { parseCricsheetMatch } from '../cricsheet';

const NOW = new Date('2026-11-02T14:00:00Z');

describe('score parsing never invents numbers', () => {
  it('reads runs/wickets, all out and declared', () => {
    expect(parseScore('139/4')).toEqual({ runs: 139, wickets: 4, declared: false, allOut: false });
    expect(parseScore('275')).toEqual({ runs: 275, wickets: null, declared: false, allOut: true });
    expect(parseScore('312/7d')).toMatchObject({ runs: 312, wickets: 7, declared: true });
  });
  it('returns nulls for anything it cannot read', () => {
    expect(parseScore('')).toMatchObject({ runs: null, wickets: null });
    expect(parseScore('abc')).toMatchObject({ runs: null, wickets: null });
    expect(parseScore('100/11')).toMatchObject({ runs: null, wickets: null });
    expect(parseScore(null)).toMatchObject({ runs: null });
  });
  it('reads the documented overs/target string', () => {
    expect(parseOversInfo('17.2/20 ov, T:138')).toEqual({ overs: '17.2', oversLimit: 20, target: 138 });
    expect(parseOversInfo('45.3 ov')).toEqual({ overs: '45.3', oversLimit: null, target: null });
    expect(parseOversInfo(undefined)).toEqual({ overs: null, oversLimit: null, target: null });
  });
  it('counts balls and rejects impossible overs', () => {
    expect(oversToBalls('17.2')).toBe(104);
    expect(oversToBalls('20')).toBe(120);
    expect(oversToBalls('3.6')).toBeNull();
  });
  it('formats scores', () => {
    expect(formatScore({ teamId: 'a', runs: 152, wickets: 4, overs: '17.2' })).toBe('152/4');
    expect(formatScore({ teamId: 'a', runs: 275, wickets: 10, overs: '88.1' })).toBe('275');
    expect(formatScore(null)).toBe('–');
  });
});

describe('run rates are calculated only from complete inputs', () => {
  it('required run rate for a chase', () => {
    expect(requiredRunRate({ target: 179, runs: 152, overs: '17.2', oversLimit: 20 })).toEqual({ runsNeeded: 27, ballsLeft: 16, rate: 10.13 });
  });
  it('null when any input is missing or the chase is over', () => {
    expect(requiredRunRate({ target: null, runs: 152, overs: '17.2', oversLimit: 20 })).toBeNull();
    expect(requiredRunRate({ target: 179, runs: 152, overs: null, oversLimit: 20 })).toBeNull();
    expect(requiredRunRate({ target: 179, runs: 152, overs: '17.2', oversLimit: null })).toBeNull();
    expect(requiredRunRate({ target: 179, runs: 180, overs: '19.1', oversLimit: 20 })).toBeNull();
    expect(requiredRunRate({ target: 179, runs: 150, overs: '20', oversLimit: 20 })).toBeNull();
  });
  it('current run rate', () => {
    expect(currentRunRate({ runs: 152, overs: '17.2' })).toBe(8.77);
    expect(currentRunRate({ runs: null, overs: '17.2' })).toBeNull();
  });
});

describe('stale feeds show as delayed', () => {
  const live = { state: 'live' as const, fetchedAt: NOW.toISOString() };
  it('fresh within the threshold, delayed after it', () => {
    expect(feedFreshness({ ...live, providerUpdatedAt: new Date(NOW.getTime() - 10 * 60_000).toISOString() }, NOW)).toBe('fresh');
    expect(feedFreshness({ ...live, providerUpdatedAt: new Date(NOW.getTime() - 26 * 60_000).toISOString() }, NOW)).toBe('delayed');
  });
  it('unknown timestamp counts as delayed; finished matches are not live', () => {
    expect(feedFreshness({ ...live, providerUpdatedAt: 'garbage', fetchedAt: 'garbage' }, NOW)).toBe('delayed');
    expect(feedFreshness({ state: 'completed', providerUpdatedAt: null, fetchedAt: NOW.toISOString() }, NOW)).toBe('not_live');
  });
});

describe('daily budget for the free plan', () => {
  const base = { usedToday: 20, dailyLimit: 100, reserve: 8, minIntervalMin: 5, lastLivePollAt: null as Date | null, now: NOW };
  it('spreads remaining calls over the remaining live minutes', () => {
    const d = liveScoresDue({ ...base, liveMinutesRemaining: 480 });
    expect(d.available).toBe(72);
    expect(d.intervalMin).toBe(7);
    expect(d.due).toBe(true);
  });
  it('never faster than the minimum interval', () => {
    expect(liveScoresDue({ ...base, liveMinutesRemaining: 30 }).intervalMin).toBe(5);
  });
  it('waits until the interval has passed', () => {
    const d = liveScoresDue({ ...base, liveMinutesRemaining: 480, lastLivePollAt: new Date(NOW.getTime() - 3 * 60_000) });
    expect(d.due).toBe(false);
  });
  it('stops when the budget is used up or nothing is live', () => {
    expect(liveScoresDue({ ...base, usedToday: 92, liveMinutesRemaining: 300 }).due).toBe(false);
    expect(liveScoresDue({ ...base, liveMinutesRemaining: 0 }).due).toBe(false);
  });
  it('counts overlapping match windows once', () => {
    const end = new Date(NOW.getTime() + 12 * 3_600_000);
    const m = (h: number, format: string) => ({ startTime: new Date(NOW.getTime() + h * 3_600_000).toISOString(), format, finished: false });
    expect(liveMinutesRemaining([m(0, 'T20'), m(1, 'T20')], NOW, end)).toBe(270);
    expect(liveMinutesRemaining([m(0, 'T20'), m(5, 'T20')], NOW, end)).toBe(420);
    expect(liveMinutesRemaining([{ ...m(0, 'T20'), finished: true }], NOW, end)).toBe(0);
  });
});

describe('labelled test data', () => {
  it('every demo match and table is marked as test data', () => {
    expect(demoMatches(NOW).every((m) => m.isTestData)).toBe(true);
    expect(demoStandings(NOW).every((s) => s.isTestData)).toBe(true);
  });
  it('covers live, upcoming and finished India, IPL, Test, ODI and T20I', () => {
    const g = groupMatches(demoMatches(NOW), NOW);
    expect(g.live.length).toBeGreaterThan(0);
    expect(g.upcoming.length).toBeGreaterThan(0);
    expect(g.results.length).toBeGreaterThan(0);
    const formats = new Set(demoMatches(NOW).map((m) => m.format));
    for (const f of ['TEST', 'ODI', 'T20I', 'T20']) expect(formats.has(f as any)).toBe(true);
    expect(applyFilter(demoMatches(NOW), 'ipl').every((m) => m.competition.isIpl)).toBe(true);
    expect(applyFilter(demoMatches(NOW), 'india').every((m) => m.teams.some((t) => t.isIndia))).toBe(true);
  });
  it('India matches lead the live list', () => {
    const g = groupMatches(demoMatches(NOW), NOW);
    expect(g.live[0].teams.some((t) => t.isIndia)).toBe(true);
  });
  it('has a scorecard whose batting adds up to the innings', () => {
    const d = demoMatchDetail(NOW, 'demo:t20i-3')!;
    const inn = d.scorecard[1];
    const batRuns = inn.batting.reduce((s, b) => s + (b.runs ?? 0), 0);
    expect(batRuns + (inn.extras ?? 0)).toBe(inn.score.runs);
  });
  it('test data is refused on Vercel production', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('SPORTS_SOURCE', 'demo');
    await expect(getCricketSource()).rejects.toBeInstanceOf(SportsUnavailableError);
  });
  it('parses filters defensively', () => {
    expect(parseFilter('ipl')).toBe('ipl');
    expect(parseFilter('<script>')).toBe('all');
    expect(parseFilter(undefined)).toBe('all');
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('Highlightly adapter (inactive; validated against a real response before use)', () => {
  const sample = {
    id: 123,
    startTime: '2026-11-02T13:30:00Z',
    league: { id: 7, name: 'Indian Premier League', season: 2026 },
    homeTeam: { id: 1, name: 'Team One', abbreviation: 'ONE' },
    awayTeam: { id: 2, name: 'India', abbreviation: 'IND' },
    state: { description: 'In progress', report: 'Team One need 9 runs', teams: { home: { score: '139/4', info: '17.2/20 ov, T:148' }, away: { score: '147/6', info: '20/20 ov' } } }
  };
  it('maps the documented fields and leaves the rest null', () => {
    const m = mapHighlightlyMatch(sample, NOW)!;
    expect(m.id).toBe('highlightly:123');
    expect(m.competition.isIpl).toBe(true);
    expect(m.state).toBe('live');
    expect(m.innings[0]).toMatchObject({ runs: 139, wickets: 4, overs: '17.2' });
    expect(m.target).toBe(148);
    expect(m.teams[1].isIndia).toBe(true);
    expect(m.isTestData).toBe(false);
    expect(m.winnerTeamId).toBeNull();
  });
  it('ignores entries without an id or teams', () => {
    expect(mapHighlightlyMatch({}, NOW)).toBeNull();
    expect(mapHighlightlyMatch({ id: 1 }, NOW)).toBeNull();
  });
  it('logs every call and throws on HTTP errors', async () => {
    const calls: any[] = [];
    const client = createHighlightlyClient({
      apiKey: 'k',
      onCall: (c) => calls.push(c),
      fetch: async () => new Response('{}', { status: 429, headers: { 'x-ratelimit-requests-remaining': '0' } })
    });
    await expect(client.matchesOn('2026-11-02', NOW)).rejects.toThrow('HTTP 429');
    expect(calls).toEqual([expect.objectContaining({ endpoint: '/matches', status: 429, ok: false, remaining: 0 })]);
  });
});

describe('Cricsheet scorecards', () => {
  const ball = (batter: string, bowler: string, runs: number, extra: Record<string, unknown> = {}) => ({ batter, bowler, non_striker: batter === 'A' ? 'B' : 'A', runs: { batter: runs, extras: (extra.extras as any)?.total ?? 0, total: runs + ((extra.extras as any)?.total ?? 0) }, ...extra });
  const json = {
    info: { match_type: 'T20', teams: ['Hawks', 'Chargers'], dates: ['2026-10-30'], event: { name: 'Sample League', match_number: 5 }, venue: 'Ground', toss: { winner: 'Hawks', decision: 'bat' }, outcome: { winner: 'Hawks', by: { runs: 3 } }, player_of_match: ['A'] },
    innings: [
      {
        team: 'Hawks',
        overs: [
          { over: 0, deliveries: [ball('A', 'X', 4), ball('A', 'X', 0), ball('A', 'X', 6), ball('A', 'X', 1), ball('B', 'X', 0, { wickets: [{ player_out: 'B', kind: 'bowled' }] }), { batter: 'C', bowler: 'X', runs: { batter: 0, extras: 1, total: 1 }, extras: { wides: 1 } }, ball('C', 'X', 2)] },
          { over: 1, deliveries: [ball('A', 'Y', 0), ball('A', 'Y', 0), ball('A', 'Y', 0), ball('A', 'Y', 0), ball('A', 'Y', 0), ball('A', 'Y', 0)] }
        ]
      }
    ]
  };
  it('builds batting, bowling, totals and result', () => {
    const s = parseCricsheetMatch(json);
    const inn = s.scorecard[0];
    expect(inn.score).toMatchObject({ runs: 14, wickets: 1, overs: '2' });
    expect(inn.batting.find((b) => b.name === 'A')).toMatchObject({ runs: 11, balls: 10, fours: 1, sixes: 1, dismissal: 'not out' });
    expect(inn.batting.find((b) => b.name === 'B')).toMatchObject({ runs: 0, balls: 1, dismissal: 'b X' });
    expect(inn.bowling.find((b) => b.name === 'X')).toMatchObject({ overs: '1', runs: 14, wickets: 1, maidens: 0 });
    expect(inn.bowling.find((b) => b.name === 'Y')).toMatchObject({ overs: '1', runs: 0, maidens: 1 });
    expect(inn.extras).toBe(1);
    expect(s.resultText).toBe('Hawks won by 3 runs');
    expect(s.matchType).toBe('T20');
    expect(s.toss).toBe('Hawks won the toss and chose to bat');
  });
});
