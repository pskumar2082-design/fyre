import { describe, it, expect } from 'vitest';
import { groupTables, headingLabel, categoryOf, sortBoxOfficeHeadings, sortAdvanceHeadings } from '../tableGroups';
import type { TTTable } from '../types';

// Minimal fixture builder -- these tests care about heading/category/sort
// behavior, not table contents, so every table gets a trivial single-row
// body.
function table(label: string): TTTable {
  return { label, headers: ['A'], rows: [{ A: '1' }] };
}

describe('categoryOf', () => {
  it('buckets a Day N heading as "day"', () => {
    expect(categoryOf('Day 1')).toBe('day');
    expect(categoryOf('Day 48')).toBe('day');
  });
  it('buckets Day-wise/Cumulative/Other as "boxoffice"', () => {
    expect(categoryOf('Day-wise Collection')).toBe('boxoffice');
    expect(categoryOf('Cumulative')).toBe('boxoffice');
    expect(categoryOf('Other')).toBe('boxoffice');
  });
  it('buckets an Advance <date> heading as "advance"', () => {
    expect(categoryOf('Advance 2026-09-23')).toBe('advance');
  });
});

describe('sortBoxOfficeHeadings', () => {
  it('orders Day-wise / Other / Cumulative regardless of input order', () => {
    const input = [{ heading: 'Cumulative' }, { heading: 'Other' }, { heading: 'Day-wise Collection' }];
    expect(sortBoxOfficeHeadings(input).map((g) => g.heading)).toEqual([
      'Day-wise Collection',
      'Other',
      'Cumulative'
    ]);
  });
});

describe('sortAdvanceHeadings', () => {
  it('sorts advance dates chronologically even when input is out of order', () => {
    const input = [
      { heading: 'Advance 2026-09-24' },
      { heading: 'Advance 2026-09-21' },
      { heading: 'Advance 2026-09-23' },
      { heading: 'Advance 2026-09-22' }
    ];
    expect(sortAdvanceHeadings(input).map((g) => g.heading)).toEqual([
      'Advance 2026-09-21',
      'Advance 2026-09-22',
      'Advance 2026-09-23',
      'Advance 2026-09-24'
    ]);
  });

  it('handles a single advance date', () => {
    const input = [{ heading: 'Advance 2026-09-23' }];
    expect(sortAdvanceHeadings(input).map((g) => g.heading)).toEqual(['Advance 2026-09-23']);
  });
});

describe('groupTables + categoryOf integration -- a full movie run', () => {
  it('handles a brand-new movie with a single tracked day and no advance/box-office tables yet', () => {
    const tables = [table('State-wise — Day 1')];
    const groups = groupTables(tables);
    expect(groups.map((g) => g.heading)).toEqual(['Day 1']);
    expect(groups.every((g) => categoryOf(g.heading) === 'day')).toBe(true);
  });

  it('handles a long-running movie with 48 tracked days, dynamically -- nothing hardcoded to 48', () => {
    const dayTables = Array.from({ length: 48 }, (_, i) => table(`State-wise — Day ${i + 1}`));
    const groups = groupTables(dayTables);
    expect(groups).toHaveLength(48);
    const dayHeadings = groups.filter((g) => categoryOf(g.heading) === 'day').map((g) => g.heading);
    expect(dayHeadings).toHaveLength(48);
    expect(dayHeadings).toContain('Day 48');
    // A 49th day appearing tomorrow needs no code change -- groupTables
    // derives headings purely from whatever table labels exist.
    const withDay49 = groupTables([...dayTables, table('State-wise — Day 49')]);
    expect(withDay49.filter((g) => categoryOf(g.heading) === 'day')).toHaveLength(49);
  });

  it('separates Day-wise/Cumulative/Other, multiple Advance dates, and tracked days into three independent categories', () => {
    const tables = [
      table('Day-wise Collection'),
      table('Cumulative Language-wise'),
      table('State-wise — Day 1'),
      table('State-wise — Day 2'),
      table('Advance 2026-09-24 — State-wise'),
      table('Advance 2026-09-21 — State-wise'),
      table('Advance 2026-09-23 — State-wise')
    ];
    const groups = groupTables(tables);
    const byCategory = { day: 0, boxoffice: 0, advance: 0 };
    for (const g of groups) byCategory[categoryOf(g.heading)]++;
    expect(byCategory).toEqual({ day: 2, boxoffice: 2, advance: 3 });

    const advanceHeadings = sortAdvanceHeadings(groups.filter((g) => categoryOf(g.heading) === 'advance'));
    expect(advanceHeadings.map((g) => headingLabel(g.heading))).toEqual([
      'Advance · 21 Sept',
      'Advance · 23 Sept',
      'Advance · 24 Sept'
    ]);
  });
});
