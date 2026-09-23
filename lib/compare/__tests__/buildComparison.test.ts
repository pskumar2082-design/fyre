import { describe, it, expect } from 'vitest';
import { buildComparison, buildComparedTable } from '../buildComparison';
import type { ComparisonMovie } from '../types';
import type { TTMovieDetails, TTTable, TTStat } from '../../tracktollywood/types';

// Minimal-but-realistic TTMovieDetails fixture builder -- only the
// fields buildComparison actually reads (stats, tables) vary per test;
// everything else is filled with harmless defaults.
function movie(
  slug: string,
  opts: { stats?: TTStat[]; tables?: TTTable[] } = {}
): ComparisonMovie {
  const details: TTMovieDetails = {
    slug,
    title: slug,
    url: `https://tracktollywood.com/box-office-collection/${slug}/`,
    state: 'live',
    poster: null,
    badgeText: null,
    headlineGross: null,
    headlineLabel: null,
    stats: opts.stats ?? [],
    meta: [],
    metaUpdatedText: null,
    tables: opts.tables ?? [],
    fetchedAt: new Date().toISOString()
  };
  return { slug, details };
}

function dayWiseTable(rows: { day: string; date: string; gross: string }[]): TTTable {
  return {
    label: 'Day-wise Collection',
    headers: ['Day', 'Date', 'Gross (₹)'],
    rows: rows.map((r) => ({ Day: r.day, Date: r.date, 'Gross (₹)': r.gross }))
  };
}

// Real TrackTollywood table labels put the CATEGORY first and the
// heading last for a per-day breakdown ("State-wise — Day 2"), but the
// ADVANCE date first and category last for an advance breakdown
// ("Advance 2026-09-18 — State-wise") -- see
// lib/tracktollywood/tableGroups.ts's groupTables(), whose regex
// (`/— (Day \d+)$/`) only recognizes "Day N" as a trailing suffix. This
// fixture mirrors that exactly rather than inventing its own label
// shape, so these tests exercise the real parsing/grouping convention.
function stateTable(heading: string, rows: { state: string; gross: string }[]): TTTable {
  const label = heading.startsWith('Advance ') ? `${heading} — State-wise` : `State-wise — ${heading}`;
  return {
    label,
    headers: ['State', 'Gross (₹)'],
    rows: rows.map((r) => ({ State: r.state, 'Gross (₹)': r.gross }))
  };
}

describe('buildComparison -- stats union', () => {
  it('unions stat labels across 2 movies, N/A (null) where one movie lacks a label', () => {
    const a = movie('movie-a', {
      stats: [
        { label: "Today's Gross", value: '₹1.10Cr', note: null },
        { label: 'Best Day', value: '₹2.00Cr', note: 'Day 1' }
      ]
    });
    const b = movie('movie-b', {
      stats: [{ label: "Today's Gross", value: '₹0.80Cr', note: null }]
    });

    const vm = buildComparison([a, b]);

    expect(vm.stats).toHaveLength(2);
    const todays = vm.stats.find((s) => s.label === "Today's Gross")!;
    expect(todays.values).toEqual(['₹1.10Cr', '₹0.80Cr']);
    const bestDay = vm.stats.find((s) => s.label === 'Best Day')!;
    // movie-b has no "Best Day" stat at all -- null, not a fabricated value.
    expect(bestDay.values).toEqual(['₹2.00Cr', null]);
  });

  it('preserves an actual scraped zero/dash distinctly from a missing stat', () => {
    const a = movie('movie-a', { stats: [{ label: 'Best Day', value: '—0', note: null }] });
    const b = movie('movie-b', { stats: [] });

    const vm = buildComparison([a, b]);
    const bestDay = vm.stats.find((s) => s.label === 'Best Day')!;
    // movie-a's own reported "—0" string passes through unchanged...
    expect(bestDay.values[0]).toBe('—0');
    // ...while movie-b (no such stat at all) is null, not the same value.
    expect(bestDay.values[1]).toBeNull();
  });
});

describe('buildComparison -- report group union', () => {
  it('unions Day N groups across movies with different run lengths, in ascending order', () => {
    const a = movie('movie-a', {
      tables: [stateTable('Day 1', [{ state: 'AP', gross: '1.0' }]), stateTable('Day 2', [{ state: 'AP', gross: '1.5' }])]
    });
    const b = movie('movie-b', {
      tables: [stateTable('Day 1', [{ state: 'TS', gross: '0.9' }])]
    });

    const vm = buildComparison([a, b]);
    const dayHeadings = vm.groups.filter((g) => g.category === 'day').map((g) => g.heading);
    expect(dayHeadings).toEqual(['Day 1', 'Day 2']);

    const day2 = vm.groups.find((g) => g.heading === 'Day 2')!;
    // movie-b has no Day 2 at all -- its slot is null, group still exists
    // because movie-a has it.
    expect(day2.categories[0].tablesByMovie).toEqual([expect.any(Object), null]);
  });

  it('unions sub-categories within a heading (e.g. movie A has State-wise + Language-wise, movie B only State-wise)', () => {
    const languageTable: TTTable = {
      label: 'Language-wise — Day 1',
      headers: ['Language', 'Gross (₹)'],
      rows: [{ Language: 'Telugu', 'Gross (₹)': '1.0' }]
    };
    const a = movie('movie-a', { tables: [stateTable('Day 1', [{ state: 'AP', gross: '1.0' }]), languageTable] });
    const b = movie('movie-b', { tables: [stateTable('Day 1', [{ state: 'TS', gross: '0.9' }])] });

    const vm = buildComparison([a, b]);
    const day1 = vm.groups.find((g) => g.heading === 'Day 1')!;
    const categories = day1.categories.map((c) => c.category);
    expect(categories).toContain('State-wise');
    expect(categories).toContain('Language-wise');

    const languageCategory = day1.categories.find((c) => c.category === 'Language-wise')!;
    expect(languageCategory.tablesByMovie[0]).not.toBeNull(); // movie-a has it
    expect(languageCategory.tablesByMovie[1]).toBeNull(); // movie-b doesn't
  });

  it('handles 3 and 4 movies, unioning across all of them', () => {
    const movies = ['m1', 'm2', 'm3', 'm4'].map((slug, i) =>
      movie(slug, { tables: i < 3 ? [stateTable('Day 1', [{ state: 'AP', gross: '1.0' }])] : [] })
    );
    const vm = buildComparison(movies);
    expect(vm.movies).toHaveLength(4);
    const day1 = vm.groups.find((g) => g.heading === 'Day 1')!;
    expect(day1.categories[0].tablesByMovie).toHaveLength(4);
    expect(day1.categories[0].tablesByMovie[3]).toBeNull(); // m4 has no tables at all
  });

  it('orders Advance <date> groups chronologically and Day-wise/Cumulative in fixed order, regardless of scrape order', () => {
    const cumulative: TTTable = { label: 'Cumulative Language-wise', headers: ['Language', 'Gross (₹)'], rows: [] };
    const dayWise: TTTable = dayWiseTable([{ day: 'Day 1', date: '1 Sep', gross: '1.0' }]);
    const advance2: TTTable = { label: 'Advance 2026-09-20 — State-wise', headers: ['State', 'Gross (₹)'], rows: [] };
    const advance1: TTTable = { label: 'Advance 2026-09-18 — State-wise', headers: ['State', 'Gross (₹)'], rows: [] };

    const a = movie('movie-a', { tables: [cumulative, advance2, dayWise, advance1] });
    const vm = buildComparison([a]);
    const headings = vm.groups.map((g) => g.heading);
    expect(headings).toEqual(['Day-wise Collection', 'Cumulative', 'Advance 2026-09-18', 'Advance 2026-09-20']);
  });
});

describe('buildComparedTable -- release-relative (Day) vs calendar-date alignment', () => {
  const a = movie('movie-a', {
    tables: [dayWiseTable([{ day: 'Day 1', date: '10 Sep 2026', gross: '1.20' }, { day: 'Day 2', date: '11 Sep 2026', gross: '0.90' }])]
  });
  const b = movie('movie-b', {
    // Released on a different real date, but "Day 1" is still directly comparable release-relative.
    tables: [dayWiseTable([{ day: 'Day 1', date: '20 Sep 2026', gross: '1.50' }])]
  });

  it('keys by Day (release-relative) by default', () => {
    const vm = buildComparison([a, b]);
    const dayWiseGroup = vm.groups.find((g) => g.heading === 'Day-wise Collection')!;
    const table = buildComparedTable(dayWiseGroup.categories[0].tablesByMovie);
    expect(table.nameColumn).toBe('Day');
    const day1 = table.rows.find((r) => r.name === 'Day 1')!;
    expect(day1.valuesByColumn['Gross (₹)']).toEqual(['1.20', '1.50']);
    // movie-b has no "Day 2" -- explicit null, not 0 or omitted.
    const day2 = table.rows.find((r) => r.name === 'Day 2')!;
    expect(day2.valuesByColumn['Gross (₹)']).toEqual(['0.90', null]);
  });

  it('keys by Date (calendar) when keyColumn is set -- different real dates never collapse into the same row', () => {
    const vm = buildComparison([a, b]);
    const dayWiseGroup = vm.groups.find((g) => g.heading === 'Day-wise Collection')!;
    const table = buildComparedTable(dayWiseGroup.categories[0].tablesByMovie, { keyColumn: 'Date' });
    expect(table.nameColumn).toBe('Date');
    const rowNames = table.rows.map((r) => r.name);
    // Movie A's "10 Sep 2026"/"11 Sep 2026" and movie B's "20 Sep 2026"
    // are three genuinely different calendar dates -- never merged.
    expect(rowNames).toEqual(['10 Sep 2026', '11 Sep 2026', '20 Sep 2026']);
    const sep20 = table.rows.find((r) => r.name === '20 Sep 2026')!;
    expect(sep20.valuesByColumn['Gross (₹)']).toEqual([null, '1.50']);
  });
});

describe('buildComparedTable -- row/column matching', () => {
  it('matches rows by name across movies and fills N/A for a row one movie lacks', () => {
    const table1 = stateTable('Day 1', [
      { state: 'Andhra Pradesh', gross: '1.0' },
      { state: 'Telangana', gross: '0.8' }
    ]);
    const table2 = stateTable('Day 1', [{ state: 'Andhra Pradesh', gross: '1.2' }]);

    const merged = buildComparedTable([table1, table2]);
    expect(merged.nameColumn).toBe('State');
    const ap = merged.rows.find((r) => r.name === 'Andhra Pradesh')!;
    expect(ap.valuesByColumn['Gross (₹)']).toEqual(['1.0', '1.2']);
    const ts = merged.rows.find((r) => r.name === 'Telangana')!;
    expect(ts.valuesByColumn['Gross (₹)']).toEqual(['0.8', null]);
  });

  it('returns an empty table (no throw) when every slot is null', () => {
    const merged = buildComparedTable([null, null]);
    expect(merged).toEqual({ nameColumn: '', columns: [], rows: [] });
  });

  it('never fabricates a value for a column a movie genuinely did not publish', () => {
    const withOccupancy: TTTable = {
      label: 'Day 1 — State-wise',
      headers: ['State', 'Gross (₹)', 'Occupancy'],
      rows: [{ State: 'AP', 'Gross (₹)': '1.0', Occupancy: '42%' }]
    };
    const withoutOccupancy: TTTable = {
      label: 'Day 1 — State-wise',
      headers: ['State', 'Gross (₹)'],
      rows: [{ State: 'AP', 'Gross (₹)': '1.1' }]
    };
    const merged = buildComparedTable([withOccupancy, withoutOccupancy]);
    expect(merged.columns).toContain('Occupancy');
    const ap = merged.rows[0];
    expect(ap.valuesByColumn.Occupancy).toEqual(['42%', null]);
  });
});
