import type { FigureDay, FigureStatus, FigureTotal, Metric, ReportedFigure, SourceId } from './types';

export const METRIC_LABEL: Record<Metric, string> = {
  india_net: 'India net',
  india_gross: 'India gross',
  overseas_gross: 'Overseas gross',
  worldwide_gross: 'Worldwide gross',
  occupancy_pct: 'Occupancy',
  shows: 'Shows'
};

export const STATUS_LABEL: Record<FigureStatus, string> = {
  early_estimate: 'Early estimate · day in progress',
  estimate: 'Estimate',
  reported: 'Reported'
};

export const SOURCE_LABEL: Record<SourceId, string> = {
  sacnilk: 'Sacnilk',
  reported: 'Reported by the producer or studio',
  demo: 'Test data'
};

export const MONEY: Metric[] = ['india_net', 'india_gross', 'overseas_gross', 'worldwide_gross'];

export function formatValue(metric: Metric, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'Not reported';
  if (metric === 'occupancy_pct') return `${v.toFixed(1)}%`;
  if (metric === 'shows') return v.toLocaleString('en-IN');
  return `₹${v.toFixed(2)} Cr`;
}

// Fyre shows one source per table and never adds figures across sources.
// Picks the first source in `preference` that has any figure for the movie.
export function pickSource(available: SourceId[], preference: SourceId[]): SourceId | null {
  for (const s of preference) if (available.includes(s)) return s;
  return null;
}

export class MixedSourcesError extends Error {}

// Guard for any code that sums or compares figures: every value must come
// from the same source. Throws instead of mixing.
export function assertSingleSource(rows: { source: SourceId }[]): SourceId | null {
  const set = new Set(rows.map((r) => r.source));
  if (set.size > 1) throw new MixedSourcesError(`Refusing to combine figures from ${[...set].join(' and ')}`);
  return rows[0]?.source ?? null;
}

export type DayRow = { day: string; dayNumber: number | null; values: Partial<Record<Metric, { value: number; status: FigureStatus; updatedAt: string | null }>> };

// Day-wise rows for one source, newest first. Missing metrics stay missing.
export function dayRows(days: FigureDay[], source: SourceId): DayRow[] {
  const mine = days.filter((d) => d.source === source);
  assertSingleSource(mine);
  const by = new Map<string, DayRow>();
  for (const d of mine) {
    const row = by.get(d.day) ?? { day: d.day, dayNumber: d.dayNumber, values: {} };
    row.values[d.metric] = { value: d.value, status: d.status, updatedAt: d.sourceUpdatedAt ?? d.fetchedAt };
    by.set(d.day, row);
  }
  return [...by.values()].sort((a, b) => b.day.localeCompare(a.day));
}

// Totals exactly as the source states them. Fyre never computes a total
// (for example worldwide = India + overseas) on the source's behalf.
export function totalsFor(totals: FigureTotal[], source: SourceId): Partial<Record<Metric, FigureTotal>> {
  const mine = totals.filter((t) => t.source === source);
  assertSingleSource(mine);
  return Object.fromEntries(mine.map((t) => [t.metric, t]));
}

export function latestReported(reported: ReportedFigure[], metric: Metric): ReportedFigure | null {
  return reported.filter((r) => r.metric === metric).sort((a, b) => b.reportedOn.localeCompare(a.reportedOn))[0] ?? null;
}

export function sourcePreference(): SourceId[] {
  const env = process.env.MOVIES_SOURCE ?? 'demo';
  return env === 'demo' ? ['demo'] : ['sacnilk'];
}
