import type { Competition, InningsCard, Match, MatchDetail, Standings, Team } from '../types';
import type { CricketSource } from '../source';

// LABELLED TEST DATA -- not real scores.
//
// Used until a live feed is approved. Every match carries isTestData, every
// page that shows it carries a "Test data" banner, and this source refuses
// to run on Vercel production (see lib/sports/source.ts). Franchise teams
// and players are fictional; country names are used only so the India and
// international filters can be tested. Times are relative to "now" so the
// page always has something live, upcoming and finished to show.

const T = (id: string, name: string, short: string, isIndia = false): Team => ({ id, name, short, isIndia });

const india = T('ind', 'India', 'IND', true);
const australia = T('aus', 'Australia', 'AUS');
const england = T('eng', 'England', 'ENG');
const newZealand = T('nz', 'New Zealand', 'NZ');
const southAfrica = T('sa', 'South Africa', 'SA');
const hawks = T('hyd', 'Hyderabad Hawks', 'HYH');
const chargers = T('che', 'Chennai Chargers', 'CHC');
const mavericks = T('mum', 'Mumbai Mavericks', 'MUM');
const royals = T('ben', 'Bengaluru Blazers', 'BLZ');
const knights = T('kol', 'Kolkata Comets', 'KOC');
const capitals = T('del', 'Delhi Dynamos', 'DLD');

const t20iSeries: Competition = { id: 'demo-t20i-aus', name: 'India v Australia T20I series', short: 'T20I series', kind: 'international', season: '2026' };
const testSeries: Competition = { id: 'demo-test-eng', name: 'India v England Test series', short: 'Test series', kind: 'international', season: '2026' };
const odiSeries: Competition = { id: 'demo-odi-nz', name: 'India v New Zealand ODI series', short: 'ODI series', kind: 'international', season: '2026' };
const saSeries: Competition = { id: 'demo-t20i-sa', name: 'England v South Africa T20I series', short: 'T20I series', kind: 'international', season: '2026' };
const ipl: Competition = { id: 'demo-ipl', name: 'Indian Premier League', short: 'IPL', kind: 'league', season: '2026', isIpl: true };

function at(base: number, hours: number): string {
  return new Date(base + hours * 3_600_000).toISOString();
}

function m(base: number, fetchedAt: string, p: Omit<Match, 'sport' | 'provider' | 'id' | 'fetchedAt' | 'isTestData'>): Match {
  return { ...p, sport: 'cricket', provider: 'demo', id: `demo:${p.providerId}`, fetchedAt, isTestData: true };
}

export function demoMatches(now: Date): Match[] {
  const base = now.getTime();
  const f = now.toISOString();
  const upd = (minAgo: number) => new Date(base - minAgo * 60_000).toISOString();
  return [
    m(base, f, {
      providerId: 't20i-3',
      competition: t20iSeries,
      format: 'T20I',
      title: '3rd T20I',
      startTime: at(base, -2.6),
      venue: 'Hyderabad',
      teams: [australia, india],
      state: 'live',
      statusText: 'India need 27 runs from 16 balls',
      innings: [
        { teamId: 'aus', runs: 178, wickets: 6, overs: '20' },
        { teamId: 'ind', runs: 152, wickets: 4, overs: '17.2' }
      ],
      target: 179,
      oversLimit: 20,
      resultText: null,
      winnerTeamId: null,
      providerUpdatedAt: upd(4)
    }),
    m(base, f, {
      providerId: 'test-2-d2',
      competition: testSeries,
      format: 'TEST',
      title: '2nd Test, Day 2',
      startTime: at(base, -30),
      venue: 'Chennai',
      teams: [india, england],
      state: 'live',
      statusText: 'India lead by 78 runs',
      innings: [
        { teamId: 'ind', runs: 312, wickets: 10, overs: '96.4', allOut: true },
        { teamId: 'eng', runs: 275, wickets: 10, overs: '88.1', allOut: true },
        { teamId: 'ind', runs: 41, wickets: 1, overs: '11' }
      ],
      target: null,
      oversLimit: null,
      resultText: null,
      winnerTeamId: null,
      providerUpdatedAt: upd(38)
    }),
    m(base, f, {
      providerId: 'ipl-41',
      competition: ipl,
      format: 'T20',
      title: 'Match 41',
      startTime: at(base, 1.5),
      venue: 'Hyderabad',
      teams: [hawks, chargers],
      state: 'scheduled',
      statusText: null,
      innings: [],
      target: null,
      oversLimit: 20,
      resultText: null,
      winnerTeamId: null,
      providerUpdatedAt: upd(60)
    }),
    m(base, f, {
      providerId: 'odi-1',
      competition: odiSeries,
      format: 'ODI',
      title: '1st ODI',
      startTime: at(base, 22),
      venue: 'Visakhapatnam',
      teams: [india, newZealand],
      state: 'scheduled',
      statusText: null,
      innings: [],
      target: null,
      oversLimit: 50,
      resultText: null,
      winnerTeamId: null,
      providerUpdatedAt: upd(120)
    }),
    m(base, f, {
      providerId: 'ipl-42',
      competition: ipl,
      format: 'T20',
      title: 'Match 42',
      startTime: at(base, 26),
      venue: 'Mumbai',
      teams: [mavericks, royals],
      state: 'scheduled',
      statusText: null,
      innings: [],
      target: null,
      oversLimit: 20,
      resultText: null,
      winnerTeamId: null,
      providerUpdatedAt: upd(120)
    }),
    m(base, f, {
      providerId: 'ipl-43',
      competition: ipl,
      format: 'T20',
      title: 'Match 43',
      startTime: at(base, 49.5),
      venue: 'Kolkata',
      teams: [knights, capitals],
      state: 'scheduled',
      statusText: null,
      innings: [],
      target: null,
      oversLimit: 20,
      resultText: null,
      winnerTeamId: null,
      providerUpdatedAt: upd(120)
    }),
    m(base, f, {
      providerId: 'sa-t20i-2',
      competition: saSeries,
      format: 'T20I',
      title: '2nd T20I',
      startTime: at(base, 70),
      venue: 'Cape Town',
      teams: [southAfrica, england],
      state: 'scheduled',
      statusText: null,
      innings: [],
      target: null,
      oversLimit: 20,
      resultText: null,
      winnerTeamId: null,
      providerUpdatedAt: upd(120)
    }),
    m(base, f, {
      providerId: 't20i-2',
      competition: t20iSeries,
      format: 'T20I',
      title: '2nd T20I',
      startTime: at(base, -48),
      venue: 'Bengaluru',
      teams: [india, australia],
      state: 'completed',
      statusText: null,
      innings: [
        { teamId: 'ind', runs: 196, wickets: 5, overs: '20' },
        { teamId: 'aus', runs: 154, wickets: 10, overs: '18.3', allOut: true }
      ],
      target: 197,
      oversLimit: 20,
      resultText: 'India won by 42 runs',
      winnerTeamId: 'ind',
      providerUpdatedAt: upd(2700)
    }),
    m(base, f, {
      providerId: 'ipl-40',
      competition: ipl,
      format: 'T20',
      title: 'Match 40',
      startTime: at(base, -21),
      venue: 'Chennai',
      teams: [chargers, mavericks],
      state: 'completed',
      statusText: null,
      innings: [
        { teamId: 'che', runs: 171, wickets: 7, overs: '20' },
        { teamId: 'mum', runs: 172, wickets: 4, overs: '19.1' }
      ],
      target: 172,
      oversLimit: 20,
      resultText: 'Mumbai Mavericks won by 6 wickets',
      winnerTeamId: 'mum',
      providerUpdatedAt: upd(1100)
    }),
    m(base, f, {
      providerId: 'ipl-39',
      competition: ipl,
      format: 'T20',
      title: 'Match 39',
      startTime: at(base, -45),
      venue: 'Bengaluru',
      teams: [royals, hawks],
      state: 'no_result',
      statusText: null,
      innings: [{ teamId: 'ben', runs: 62, wickets: 1, overs: '6.2' }],
      target: null,
      oversLimit: 20,
      resultText: 'No result (rain)',
      winnerTeamId: null,
      providerUpdatedAt: upd(2500)
    })
  ];
}

const p = (name: string, dismissal: string | null, runs: number, balls: number, fours: number, sixes: number) => ({ name, dismissal, runs, balls, fours, sixes });
const b = (name: string, overs: string, maidens: number, runs: number, wickets: number) => ({ name, overs, maidens, runs, wickets });

function liveT20Scorecard(): InningsCard[] {
  return [
    {
      number: 1,
      teamId: 'aus',
      score: { teamId: 'aus', runs: 178, wickets: 6, overs: '20' },
      batting: [
        p('A. Carter (test)', 'c Reddy b Varma', 54, 36, 6, 2),
        p('J. Hollis (test)', 'b Naidu', 12, 10, 2, 0),
        p('M. Ward (test)', 'lbw b Rao', 41, 29, 3, 2),
        p('S. Fenwick (test)', 'c Kumar b Varma', 28, 17, 1, 2),
        p('L. Doyle (test)', 'run out', 19, 13, 2, 0),
        p('T. Bligh (test)', 'c & b Naidu', 9, 8, 0, 1),
        p('R. Quinn (test)', 'not out', 7, 5, 1, 0)
      ],
      bowling: [b('S. Varma (test)', '4', 0, 31, 2), b('P. Naidu (test)', '4', 0, 36, 2), b('K. Rao (test)', '4', 0, 29, 1), b('V. Reddy (test)', '4', 0, 42, 0), b('A. Kumar (test)', '4', 0, 38, 0)],
      extras: 8,
      fallOfWickets: '1-24, 2-97, 3-121, 4-150, 5-163, 6-171'
    },
    {
      number: 2,
      teamId: 'ind',
      score: { teamId: 'ind', runs: 152, wickets: 4, overs: '17.2' },
      batting: [
        p('R. Sharma (test)', 'c Ward b Bligh', 33, 22, 4, 1),
        p('V. Reddy (test)', 'b Quinn', 18, 15, 3, 0),
        p('K. Varma (test)', 'not out', 61, 40, 5, 3),
        p('A. Kumar (test)', 'c Doyle b Bligh', 22, 14, 1, 2),
        p('H. Patel (test)', 'run out', 9, 7, 1, 0),
        p('S. Iyer (test)', 'not out', 5, 6, 0, 0)
      ],
      bowling: [b('T. Bligh (test)', '4', 0, 30, 2), b('R. Quinn (test)', '3.2', 0, 27, 1), b('L. Doyle (test)', '4', 0, 36, 0), b('M. Ward (test)', '3', 0, 28, 0), b('S. Fenwick (test)', '3', 0, 27, 0)],
      extras: 4,
      fallOfWickets: '1-41, 2-58, 3-112, 4-138'
    }
  ];
}

export function demoMatchDetail(now: Date, id: string): MatchDetail | null {
  const match = demoMatches(now).find((x) => x.id === id || x.providerId === id);
  if (!match) return null;
  const scorecard = match.providerId === 't20i-3' ? liveT20Scorecard() : [];
  return {
    ...match,
    toss: match.providerId === 't20i-3' ? 'Australia won the toss and chose to bat' : null,
    playerOfMatch: match.state === 'completed' && match.providerId === 't20i-2' ? 'K. Varma (test)' : null,
    scorecard
  };
}

export function demoStandings(now: Date): Standings[] {
  const rows = [
    [mavericks, 9, 7, 2, 0, 14, 0.91],
    [hawks, 9, 6, 2, 1, 13, 0.62],
    [chargers, 9, 5, 4, 0, 10, 0.18],
    [knights, 9, 5, 4, 0, 10, -0.05],
    [royals, 9, 3, 5, 1, 7, -0.44],
    [capitals, 9, 1, 8, 0, 2, -1.21]
  ] as const;
  return [
    {
      competition: ipl,
      updatedAt: new Date(now.getTime() - 20 * 3_600_000).toISOString(),
      isTestData: true,
      rows: rows.map(([team, played, won, lost, noResult, points, nrr], i) => ({ position: i + 1, team, played, won, lost, noResult, points, nrr }))
    }
  ];
}

export const demoSource: CricketSource = {
  id: 'demo',
  label: 'Test data',
  isTestData: true,
  async listMatches(now) {
    return demoMatches(now);
  },
  async getMatch(now, id) {
    return demoMatchDetail(now, id);
  },
  async listStandings(now) {
    return demoStandings(now);
  }
};
