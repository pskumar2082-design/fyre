// Daily request budget for a free cricket plan (Highlightly BASIC: 100
// requests a day). One "today's matches" call returns every live score, so
// live polling is the main spend; the scheduler spreads what is left of the
// day's budget across the live minutes that remain.
//
// Pure functions only -- the sync job passes in today's usage from
// sp_call_log, so this is unit-tested without any network.

export type BudgetInput = {
  usedToday: number;
  dailyLimit: number; // 100 on the free plan
  reserve: number; // kept back for fixtures / standings / scorecards
  minIntervalMin: number; // never poll faster than this
  liveMinutesRemaining: number; // estimated minutes of live cricket left today (IST)
  lastLivePollAt: Date | null;
  now: Date;
};

export type BudgetDecision = { due: boolean; intervalMin: number; available: number; reason: string };

export function liveScoresDue(input: BudgetInput): BudgetDecision {
  const available = input.dailyLimit - input.reserve - input.usedToday;
  if (available <= 0) return { due: false, intervalMin: Infinity, available: Math.max(0, available), reason: 'daily budget used up' };
  if (input.liveMinutesRemaining <= 0) return { due: false, intervalMin: Infinity, available, reason: 'no live cricket' };
  const intervalMin = Math.max(input.minIntervalMin, Math.ceil(input.liveMinutesRemaining / available));
  if (!input.lastLivePollAt) return { due: true, intervalMin, available, reason: 'first live poll today' };
  const since = (input.now.getTime() - input.lastLivePollAt.getTime()) / 60_000;
  return since >= intervalMin
    ? { due: true, intervalMin, available, reason: `${Math.floor(since)} min since last poll` }
    : { due: false, intervalMin, available, reason: `next poll in ${Math.ceil(intervalMin - since)} min` };
}

// Expected length of a match in minutes, used to estimate the live minutes
// left today. Rough on purpose: a Test day is ~7 h, ODI ~8 h, T20 ~3.5 h.
export function expectedMatchMinutes(format: string): number {
  switch (format) {
    case 'TEST':
      return 420;
    case 'ODI':
      return 480;
    case 'T20I':
    case 'T20':
      return 210;
    default:
      return 240;
  }
}

// Minutes of live cricket left today across the followed matches. Windows
// that overlap are counted once, because one call covers all of them.
export function liveMinutesRemaining(matches: { startTime: string; format: string; finished: boolean }[], now: Date, endOfDay: Date): number {
  const windows = matches
    .filter((m) => !m.finished)
    .map((m) => {
      const start = Date.parse(m.startTime);
      return [Math.max(start, now.getTime()), Math.min(start + expectedMatchMinutes(m.format) * 60_000, endOfDay.getTime())] as const;
    })
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let curA = -1;
  let curB = -1;
  for (const [a, b] of windows) {
    if (a > curB) {
      if (curB > curA) total += curB - curA;
      curA = a;
      curB = b;
    } else curB = Math.max(curB, b);
  }
  if (curB > curA) total += curB - curA;
  return Math.round(total / 60_000);
}
