import { describe, expect, it } from 'vitest';
import { dateRange, defaultTargets, istDate, pickSlug, sizeBatches, toRow } from '../sync';
import { normalizeSummaryFile } from '../normalize';

describe('dates', () => {
  it('uses the India calendar day, not UTC', () => {
    // 20:00 UTC on 29 Sep is already 30 Sep 01:30 in India.
    const now = new Date('2026-09-29T20:00:00Z');
    expect(istDate(0, now)).toBe('2026-09-30');
    expect(istDate(-1, now)).toBe('2026-09-29');
  });
  it('syncs today + yesterday box office and advance for today through +4 days', () => {
    expect(defaultTargets(new Date('2026-09-29T10:00:00Z'))).toEqual([
      { kind: 'boxoffice', date: '2026-09-29' },
      { kind: 'boxoffice', date: '2026-09-28' },
      { kind: 'advance', date: '2026-09-29' },
      { kind: 'advance', date: '2026-09-30' },
      { kind: 'advance', date: '2026-10-01' },
      { kind: 'advance', date: '2026-10-02' },
      { kind: 'advance', date: '2026-10-03' }
    ]);
  });
  it('expands an inclusive date range across a month boundary', () => {
    expect(dateRange('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(dateRange('bad', '2026-10-02')).toEqual([]);
  });
});

describe('toRow', () => {
  it('stores the compact breakdown form', () => {
    const [day] = normalizeSummaryFile(
      {
        last_updated: 'x',
        movies: {
          'Film [2D | Telugu]': {
            shows: 1, gross: 10, sold: 1, totalSeats: 10, venues: 1, cities: 1, fastfilling: 0, housefull: 0, occupancy: 10,
            details: [{ city: 'Hyderabad', state: 'Telangana', venues: 1, shows: 1, gross: 10, sold: 1, totalSeats: 10, fastfilling: 0, housefull: 0, occupancy: 10 }]
          }
        }
      },
      'boxoffice',
      '2026-09-28',
      new Map()
    );
    const row = toRow(day, '2026-09-28T00:00:00Z');
    expect(row).toMatchObject({ slug: 'film', kind: 'boxoffice', date: '2026-09-28', title: 'Film', source_updated: 'x', pruned: false });
    expect(row.breakdown.cities).toEqual([['Hyderabad', 'Telangana', 10, 1, 1, 10, 0, 0]]);
  });
});

describe('sizeBatches', () => {
  it('splits on row count and on payload size, never leaving a batch empty', () => {
    expect(sizeBatches([1, 2, 3, 4, 5], 1e9, 2)).toEqual([[1, 2], [3, 4], [5]]);
    const big = 'x'.repeat(300);
    expect(sizeBatches([big, big, big], 700, 25).map((b) => b.length)).toEqual([2, 1]);
    expect(sizeBatches(['x'.repeat(2000)], 100, 25)).toEqual([['x'.repeat(2000)]]);
    expect(sizeBatches([], 100, 25)).toEqual([]);
  });
});

describe('pickSlug', () => {
  it('keeps the plain slug when free, otherwise the first free numbered one', () => {
    expect(pickSlug('youth', new Set())).toBe('youth');
    expect(pickSlug('youth', new Set(['youth', 'youth-2']))).toBe('youth-3');
  });
});

import { summaryUrls } from '../fetch';

describe('summaryUrls', () => {
  const now = new Date('2026-09-29T10:00:00Z');
  it('tries the current host first for recent dates', () => {
    expect(summaryUrls('boxoffice', '2026-09-28', now)[0]).toBe('https://bfilmyapi.pages.dev/daily/data/20260928/finalsummary.json');
  });
  it('tries the yearly archive first for older dates', () => {
    expect(summaryUrls('advance', '2026-05-06', now)).toEqual([
      'https://bfilmyapi2026.pages.dev/advance/data/2026/05-06_finalsummary.json',
      'https://bfilmyapi.pages.dev/advance/data/20260506/finalsummary.json'
    ]);
  });
});
