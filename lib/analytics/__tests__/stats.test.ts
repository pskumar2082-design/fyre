import { describe, expect, it } from 'vitest';
import { buildStats, pageOf, pointsInRange, scenario, sortRows, totalsOf, type StatsRow } from '../statsModel';
import { makeMetrics } from '../metrics';
import { formatGross, formatMoney, formatUsd } from '../format';
import { axisMoney, fmtColumn } from '@/components/stats/fmt';
import type { DayPoint, MovieAnalytics } from '../types';

const day = (date: string, gross: number, o: Partial<DayPoint> & { seats?: number; ff?: number | null; day?: number | null } = {}): DayPoint => ({
  date,
  day: o.day ?? null,
  label: o.day != null ? `Day ${o.day}` : date,
  final: o.final ?? true,
  detail: false,
  breakdowns: o.breakdowns ?? true,
  metrics: makeMetrics({ gross, tickets: gross / 200, shows: 10, seats: o.seats ?? gross / 50, ff: o.ff === undefined ? 2 : o.ff, hf: o.ff === undefined ? 0 : o.ff, venues: 5 }),
  sourceUpdated: `${date} 23:40 IST`,
  window: o.window,
  occupancySource: o.occupancySource ?? null,
  completedAsOf: o.completedAsOf ?? null
});

const base = (o: Partial<MovieAnalytics> = {}): MovieAnalytics => ({
  slug: 'test-movie',
  title: 'Test Movie',
  poster: null,
  languages: ['Telugu'],
  formats: [],
  state: 'final',
  dayOne: '2026-09-24',
  premiereDate: null,
  carriedOver: false,
  historyStart: null,
  latestDay: null,
  days: [],
  advance: [],
  lifetime: { ...makeMetrics({ gross: 0, tickets: 0, shows: 0, seats: 0 }), days: 0, complete: false },
  lastUpdated: null,
  ...o
});

describe('buildStats', () => {
  it('official total = tracked window only; later days separate, never added', () => {
    const m = base({
      days: [day('2026-09-24', 1000, { day: 1 }), day('2026-09-25', 800, { day: 2 })],
      laterDays: [day('2026-10-03', 90, { day: 10, window: 'later' }), day('2026-10-04', 60, { day: 11, window: 'later' })],
      window: { start: '2026-09-24', end: '2026-09-25', officialGross: 1800, cumulativeGross: 1800, cumulativeVenues: 7, cumulativeCities: 3, advanceDates: [], officialDate: '2026-09-25', cumulativeStamp: '2026-09-25 23:40 IST' }
    });
    const s = buildStats(m, '2026-10-14', { moviemint: true });
    expect(s.official).toMatchObject({ gross: 1800, days: 2, start: '2026-09-24', end: '2026-09-25', venues: 7, check: { ok: true } });
    expect(s.later).toMatchObject({ gross: 150, days: 2, first: '2026-10-03', last: '2026-10-04' });
    expect(s.points.map((p) => [p.date, p.window])).toEqual([
      ['2026-09-24', 'tracked'],
      ['2026-09-25', 'tracked'],
      ['2026-10-03', 'later'],
      ['2026-10-04', 'later']
    ]);
    expect(s.totalLabel).toBe('Official tracked total');
    expect(s.opening?.date).toBe('2026-09-24');
    expect(s.dimensions.find((d) => d.key === 'territory')?.available).toBe(true);
    expect(s.dimensions.find((d) => d.key === 'chain')?.available).toBe(false);
  });

  it('flags a window that does not reconcile with the published total', () => {
    const m = base({ days: [day('2026-09-24', 1000)], window: { start: null, end: null, officialGross: 5000, cumulativeGross: null, cumulativeVenues: null, cumulativeCities: null, advanceDates: [], officialDate: '2026-09-24', officialStamp: '2026-09-25 03:02 IST' } });
    expect(buildStats(m, '2026-10-14', { moviemint: true }).official.check).toMatchObject({ ok: false, publishedGross: 5000 });
  });

  it('a total published while the last day was still live is not compared (different moment)', () => {
    // list total 412.87 Cr captured at 21:40 on 14 Oct; the day then finished higher
    const w = { start: null, end: null, officialGross: 4128, cumulativeGross: 4128, cumulativeVenues: null, cumulativeCities: null, advanceDates: [], officialDate: '2026-10-14', cumulativeStamp: '2026-10-14 21:40 IST' };
    const m = base({ days: [day('2026-10-13', 4000), day('2026-10-14', 139)], window: w });
    expect(buildStats(m, '2026-10-15', { moviemint: true }).official.check).toBeNull(); // both read at 21:40, before the day ended
    const after = base({ days: [day('2026-10-13', 4000), day('2026-10-14', 139)], window: { ...w, officialGross: 4139, officialStamp: '2026-10-15 03:02 IST', cumulativeStamp: '2026-10-14 23:39 IST', cumulativeGross: 4139 } });
    expect(buildStats(after, '2026-10-15', { moviemint: true }).official.check).toMatchObject({ publishedGross: 4139, reportGross: 4139, ok: true });
    const m2 = base({ days: [day('2026-10-13', 4000), day('2026-10-14', 139)], window: { ...w, officialDate: '2026-10-13' } });
    expect(buildStats(m2, '2026-10-15', { moviemint: true }).official.check).toBeNull();
    // a live last day: nothing to compare yet
    const m3 = base({ days: [day('2026-10-13', 4000), day('2026-10-14', 139, { final: false })], window: { ...w, officialGross: 1 } });
    expect(buildStats(m3, '2026-10-14', { moviemint: true }).official.check).toBeNull();
  });

  it('empty state: nothing tracked yet -> every card says why, nothing is zero-filled', () => {
    const s = buildStats(base(), '2026-10-14');
    expect(s.points).toEqual([]);
    expect(s.today).toBeNull();
    expect(s.later).toBeNull();
    expect(s.cards.filter((c) => c.available)).toEqual([]);
    expect(s.cards.find((c) => c.key === 'official')?.reason).toBe('No box office tracked yet');
  });

  it('live day: today with its completed-as-of time; missing seats stay missing', () => {
    const m = base({ state: 'live', days: [day('2026-10-13', 500, { day: 20 }), { ...day('2026-10-14', 120, { day: 21, final: false, completedAsOf: '20:40 IST', occupancySource: 18.5 }), metrics: makeMetrics({ gross: 120, tickets: 1, shows: 3, seats: 0 }) }] });
    const s = buildStats(m, '2026-10-14', { moviemint: true });
    expect(s.today).toMatchObject({ date: '2026-10-14', completedAsOf: '20:40 IST', seats: null, occupancy: null, occupancySource: 18.5 });
    // a sum over days where one lacks seats has no seats / occupancy
    expect(s.official.seats).toBeNull();
    expect(s.official.occupancy).toBeNull();
  });

  it('USA: no FF/HF, no later days, theatres; advance history is daily', () => {
    const m = base({ territory: 'US', currency: 'USD', days: [day('2026-10-02', 50_000, { day: 1, ff: null })], advance: [day('2026-10-16', 9000, { final: false })] });
    const s = buildStats(m, '2026-10-14');
    expect(s.currency).toBe('USD');
    expect(s.cards.find((c) => c.key === 'ff')).toMatchObject({ available: false, reason: 'Not provided for the USA' });
    expect(s.cards.find((c) => c.key === 'later')).toMatchObject({ available: false, reason: 'Not tracked for the USA' });
    expect(s.cards.find((c) => c.key === 'venues')?.label).toBe('Theatres');
    expect(s.advance.map((a) => a.date)).toEqual(['2026-10-16']);
    expect(s.advanceHistory).toBe('daily');
    expect(s.dimensions.map((d) => d.key)).toContain('theater');
    expect(s.sourceLabel).not.toMatch(/bfilmy|moviemint/i);
  });

  it('carried-over movie is a tracked period, never lifetime', () => {
    const s = buildStats(base({ carriedOver: true, historyStart: '2026-06-01', dayOne: null, days: [day('2026-06-01', 10), day('2026-06-02', 10)] }), '2026-10-14');
    expect(s.totalLabel).toBe('Total tracked');
    expect(s.cards.find((c) => c.key === 'opening')).toMatchObject({ available: false, reason: 'Released before tracking began' });
  });
});

describe('table helpers', () => {
  const rows: StatsRow[] = [
    { key: 'a', name: 'Andhra', sub: null, values: { gross: 10, occupancy: null } },
    { key: 'b', name: 'Bihar', sub: null, values: { gross: 30, occupancy: 20 } },
    { key: 'c', name: 'Chennai', sub: null, values: { gross: 20, occupancy: 40 } }
  ];
  it('sorts both ways with missing values always last', () => {
    expect(sortRows(rows, 'occupancy', 'desc').map((r) => r.key)).toEqual(['c', 'b', 'a']);
    expect(sortRows(rows, 'occupancy', 'asc').map((r) => r.key)).toEqual(['b', 'c', 'a']);
    expect(sortRows(rows, 'name', 'desc').map((r) => r.key)).toEqual(['c', 'b', 'a']);
  });
  it('pages and clamps the page size', () => {
    expect(pageOf([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
    expect(pageOf(Array.from({ length: 500 }, (_, i) => i), 0, 1000)).toHaveLength(100);
  });
  it('date range + window selection', () => {
    const s = buildStats(base({ days: [day('2026-09-24', 1), day('2026-09-25', 1)], laterDays: [day('2026-10-03', 1, { window: 'later' })] }), '2026-10-14', { moviemint: true });
    expect(pointsInRange(s.points, '2026-09-25', null, 'all').map((p) => p.date)).toEqual(['2026-09-25', '2026-10-03']);
    expect(pointsInRange(s.points, null, null, 'later').map((p) => p.date)).toEqual(['2026-10-03']);
    expect(totalsOf(pointsInRange(s.points, null, null, 'tracked')).gross).toBe(2);
  });
});

describe('scenario calculator (estimate only)', () => {
  it('geometric decay with a weekend lift; never negative', () => {
    const p = scenario(1000, 3, 10, 50, 4); // from a Thursday: Fri, Sat, Sun
    expect(p.map((x) => x.gross)).toEqual([900, 1215, 1093.5]);
    expect(scenario(-5, 2, 10)).toEqual([
      { day: 1, gross: 0 },
      { day: 2, gross: 0 }
    ]);
  });
});

describe('source-specific currency formatting', () => {
  it('India in lakh / crore rupees, USA in dollars; never mixed', () => {
    expect(formatGross(12_345_678)).toBe('₹1.23 Cr');
    expect(formatGross(250_000)).toBe('₹2.50 L');
    expect(formatUsd(1_320_000)).toBe('$1.32M');
    expect(formatMoney(5000, 'USD')).toBe('$5,000');
    expect(formatMoney(5000, 'INR')).toBe('₹5,000');
    expect(axisMoney(150_000_000, 'INR')).toBe('₹15 Cr');
    expect(axisMoney(2_500_000, 'USD')).toBe('$2.5M');
    expect(fmtColumn('gross', null, 'INR')).toBe('—');
    expect(fmtColumn('share', 12.345, 'INR')).toBe('12.3%');
  });
});
