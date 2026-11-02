import type { BattingRow, BowlingRow, InningsCard, MatchFormat } from './types';

// Cricsheet (https://cricsheet.org) publishes ball-by-ball data for finished
// matches -- Tests, ODIs, T20Is and the IPL among them -- under the Open
// Data Commons Attribution License. Fyre uses it for finished-match
// scorecards and must credit Cricsheet wherever that data is shown.
//
// This turns one Cricsheet JSON match file into Fyre scorecards. Pure
// function: the import script downloads and unzips the "recently added"
// file, then passes each match here.

export type CricsheetSummary = {
  matchType: MatchFormat;
  event: string | null;
  matchNumber: number | null;
  dates: string[];
  venue: string | null;
  city: string | null;
  teams: [string, string];
  toss: string | null;
  resultText: string | null;
  winner: string | null;
  playerOfMatch: string | null;
  scorecard: InningsCard[];
};

const BOWLER_NOT_CREDITED = new Set(['run out', 'retired hurt', 'retired out', 'obstructing the field', 'timed out', 'retired not out']);

function formatOf(t: string | undefined): MatchFormat {
  switch ((t ?? '').toUpperCase()) {
    case 'TEST':
    case 'MDM':
      return 'TEST';
    case 'ODI':
      return 'ODI';
    case 'T20':
      return 'T20';
    case 'IT20':
      return 'T20I';
    default:
      return 'OTHER';
  }
}

function dismissalText(w: any): string {
  const kind = String(w.kind ?? '');
  const fielders = (w.fielders ?? []).map((f: any) => f?.name).filter(Boolean);
  if (kind === 'caught') return `c ${fielders[0] ?? '?'} b ${w.bowler ?? '?'}`;
  if (kind === 'caught and bowled') return `c & b ${w.bowler ?? '?'}`;
  if (kind === 'bowled') return `b ${w.bowler ?? '?'}`;
  if (kind === 'lbw') return `lbw b ${w.bowler ?? '?'}`;
  if (kind === 'stumped') return `st ${fielders[0] ?? '?'} b ${w.bowler ?? '?'}`;
  if (kind === 'run out') return fielders.length ? `run out (${fielders.join('/')})` : 'run out';
  return kind;
}

export function parseCricsheetMatch(json: any): CricsheetSummary {
  const info = json?.info ?? {};
  const teams = (info.teams ?? ['?', '?']) as [string, string];
  const scorecard: InningsCard[] = [];

  (json?.innings ?? []).forEach((inn: any, idx: number) => {
    const bat = new Map<string, BattingRow>();
    const bowl = new Map<string, { balls: number; runs: number; wickets: number; overRuns: Map<number, { runs: number; legal: number }> }>();
    let runs = 0;
    let wickets = 0;
    let legalBalls = 0;
    let extras = 0;
    const fow: string[] = [];
    const batter = (name: string) => {
      if (!bat.has(name)) bat.set(name, { name, dismissal: 'not out', runs: 0, balls: 0, fours: 0, sixes: 0 });
      return bat.get(name)!;
    };
    for (const over of inn.overs ?? []) {
      for (const d of over.deliveries ?? []) {
        const ex = d.extras ?? {};
        const isWide = ex.wides != null;
        const isNoBall = ex.noballs != null;
        const bRow = batter(d.batter);
        if (d.non_striker) batter(d.non_striker);
        const batterRuns = d.runs?.batter ?? 0;
        bRow.runs = (bRow.runs ?? 0) + batterRuns;
        if (!isWide) bRow.balls = (bRow.balls ?? 0) + 1;
        if (batterRuns === 4 && !d.runs?.non_boundary) bRow.fours = (bRow.fours ?? 0) + 1;
        if (batterRuns === 6) bRow.sixes = (bRow.sixes ?? 0) + 1;

        if (!bowl.has(d.bowler)) bowl.set(d.bowler, { balls: 0, runs: 0, wickets: 0, overRuns: new Map() });
        const bw = bowl.get(d.bowler)!;
        // Byes and leg byes are not charged to the bowler.
        const charged = (d.runs?.total ?? 0) - (ex.byes ?? 0) - (ex.legbyes ?? 0) - (ex.penalty ?? 0);
        bw.runs += charged;
        const ov = bw.overRuns.get(over.over) ?? { runs: 0, legal: 0 };
        ov.runs += charged;
        if (!isWide && !isNoBall) ov.legal += 1;
        bw.overRuns.set(over.over, ov);
        if (!isWide && !isNoBall) {
          bw.balls += 1;
          legalBalls += 1;
        }
        runs += d.runs?.total ?? 0;
        extras += d.runs?.extras ?? 0;
        for (const w of d.wickets ?? []) {
          wickets += 1;
          batter(w.player_out).dismissal = dismissalText({ ...w, bowler: d.bowler });
          if (!BOWLER_NOT_CREDITED.has(w.kind)) bw.wickets += 1;
          fow.push(`${wickets}-${runs}`);
        }
      }
    }
    const overs = `${Math.floor(legalBalls / 6)}${legalBalls % 6 ? `.${legalBalls % 6}` : ''}`;
    const bowling: BowlingRow[] = [...bowl.entries()].map(([name, v]) => ({
      name,
      overs: `${Math.floor(v.balls / 6)}${v.balls % 6 ? `.${v.balls % 6}` : ''}`,
      // A maiden: a complete over by this bowler with no runs charged to him.
      maidens: [...v.overRuns.values()].filter((o) => o.legal === 6 && o.runs === 0).length,
      runs: v.runs,
      wickets: v.wickets
    }));
    const declared = !!inn.declared;
    scorecard.push({
      number: idx + 1,
      teamId: inn.team,
      score: { teamId: inn.team, runs, wickets, overs, declared, allOut: wickets === 10 },
      batting: [...bat.values()],
      bowling,
      extras,
      fallOfWickets: fow.length ? fow.join(', ') : null
    });
  });

  const outcome = info.outcome ?? {};
  let resultText: string | null = null;
  if (outcome.winner) {
    const by = outcome.by ?? {};
    resultText = by.runs != null ? `${outcome.winner} won by ${by.runs} runs` : by.wickets != null ? `${outcome.winner} won by ${by.wickets} wickets` : `${outcome.winner} won`;
  } else if (outcome.result) resultText = outcome.result === 'no result' ? 'No result' : `Match ${outcome.result}`;

  return {
    matchType: formatOf(info.match_type),
    event: info.event?.name ?? null,
    matchNumber: info.event?.match_number ?? null,
    dates: info.dates ?? [],
    venue: info.venue ?? null,
    city: info.city ?? null,
    teams,
    toss: info.toss ? `${info.toss.winner} won the toss and chose to ${info.toss.decision}` : null,
    resultText,
    winner: outcome.winner ?? null,
    playerOfMatch: (info.player_of_match ?? [])[0] ?? null,
    scorecard
  };
}

export const CRICSHEET_ATTRIBUTION = 'Finished-match scorecards: data from Cricsheet (cricsheet.org), Open Data Commons Attribution License.';
