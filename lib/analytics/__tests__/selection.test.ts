import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('@/lib/tracking', () => ({ publicTrackedSlugs: async () => new Set<string>() }));

import { firstNDays, resolveSelection, selectionLabel } from '../load';
import { trendSeries } from '../compare';
import { contextLine } from '../query';
import { makeMetrics } from '../metrics';
import type { DayPoint, MovieAnalytics } from '../types';

function day(date: string, n: number | null, gross: number): DayPoint {
  return { date, day: n, label: n == null ? 'Pre-release' : `Day ${n}`, final: true, detail: false, breakdowns: false, metrics: makeMetrics({ gross, tickets: gross / 100, seats: gross / 50, shows: 1 }), sourceUpdated: null };
}

// Stray pre-release show, Day 0 premiere, then Day 1..4.
const movie = {
  slug: 'm',
  title: 'M',
  carriedOver: false,
  days: [day('2026-09-20', null, 5), day('2026-09-23', 0, 1000), day('2026-09-24', 1, 100), day('2026-09-25', 2, 200), day('2026-09-26', 3, 300), day('2026-09-27', 4, 400)]
} as unknown as MovieAnalytics;

describe('First N days', () => {
  it('is release Day 1..N and never includes pre-release dates', () => {
    expect(firstNDays(movie, 3)?.map((d) => d.date)).toEqual(['2026-09-24', '2026-09-25', '2026-09-26']);
    expect(firstNDays(movie, 1)?.map((d) => d.day)).toEqual([1]);
    const r = resolveSelection(movie, { basis: 'cumulative', day: 3 });
    expect(r.reason).toBeNull();
    expect(r.points.map((p) => p.day)).toEqual([1, 2, 3]);
  });

  it('keeps the not-tracked behaviour when Day N has not happened', () => {
    expect(firstNDays(movie, 7)).toBeNull();
    const r = resolveSelection(movie, { basis: 'cumulative', day: 7 });
    expect(r.points).toEqual([]);
    expect(r.reason).toBe('Not tracked for Day 7');
  });

  it('leaves pre-release in the data: Day 0 and lifetime still include it', () => {
    expect(resolveSelection(movie, { basis: 'day', day: 0 }).points.map((p) => p.date)).toEqual(['2026-09-23']);
    expect(resolveSelection(movie, { basis: 'lifetime' }).points).toHaveLength(6);
  });

  it('running trend uses the same definition', () => {
    const t = trendSeries([movie], 'gross', true, 4);
    expect(t.map((p) => p.values[0])).toEqual([100, 300, 600, 1000]);
  });

  it('labels', () => {
    expect(selectionLabel({ basis: 'cumulative', day: 3 })).toBe('First 3 days');
    expect(selectionLabel({ basis: 'cumulative', day: 1 })).toBe('First 1 day');
    expect(contextLine({ basis: 'cumulative', day: 3 })).toBe('FIRST 3 DAYS · INDIA · ALL LANGUAGES');
    expect(contextLine({ basis: 'day', day: 1 })).toBe('DAY 1 · INDIA · ALL LANGUAGES');
    expect(contextLine({ basis: 'day', day: 1 })).not.toContain('•');
  });
});
