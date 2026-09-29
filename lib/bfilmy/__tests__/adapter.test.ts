import { describe, expect, it } from 'vitest';
import {
  dayNumber,
  detailsFromData,
  formatDate,
  formatMoney,
  listedFromRow,
  movieState,
  parseAmountToCr,
  parseReleaseDate,
  type BfMovieRow,
  type BfStoredDay
} from '../adapter';
import { categoryOf, groupTables } from '@/lib/tracktollywood/tableGroups';
import { buildComparedTable } from '@/lib/compare/buildComparison';

const TODAY = '2026-09-29';

const figs = (gross: number, sold: number, shows: number, totalSeats: number) => ({ gross, sold, shows, totalSeats, fastfilling: 0, housefull: 0 });

const row = (over: Partial<BfMovieRow> = {}): BfMovieRow => ({
  slug: 'the-paradise',
  title: 'The Paradise',
  languages: ['Telugu', 'Hindi', 'Tamil', 'Kannada'],
  formats: ['2D', 'EPIQ'],
  poster: 'https://cdn.district.in/p.jpg',
  release_date: '2026-09-26',
  first_date: '2026-09-26',
  last_date: '2026-09-29',
  days_tracked: 4,
  total_gross: '498000000',
  total_sold: 2781310,
  total_shows: 59410,
  total_seats: 17107000,
  latest: { date: '2026-09-29', ...figs(49800000, 278131, 5941, 1710700) },
  best: { date: '2026-09-26', ...figs(200000000, 900000, 6000, 1800000) },
  advance: { date: '2026-09-30', ...figs(18600000, 110749, 5430, 1800000) },
  advance_date: '2026-09-30',
  source_updated: '2026-09-29 18:53 IST',
  ...over
});

const day = (kind: 'boxoffice' | 'advance', date: string, gross: number): BfStoredDay => ({
  kind,
  date,
  totals: figs(gross, gross / 100, 10, gross / 25),
  breakdown: {
    states: [{ name: 'Telangana', ...figs(gross * 0.6, gross / 250, 6, gross / 60) }, { name: 'Andhra Pradesh', ...figs(gross * 0.4, gross / 250, 4, gross / 60) }],
    formats: [{ name: '2D', ...figs(gross, gross / 100, 10, gross / 25) }],
    languages: [{ name: 'Telugu', ...figs(gross, gross / 100, 10, gross / 25) }],
    cities: [['Hyderabad', 'Telangana', gross * 0.5, gross / 200, 5, gross / 50, 0, 0]],
    chains: [['PVR', gross * 0.3, gross / 300, 3, gross / 75, 0, 0]]
  }
});

describe('formatting', () => {
  it('formats money the way the existing parsers read it', () => {
    expect(formatMoney(49_800_000)).toBe('₹4.98 Cr');
    expect(formatMoney(4_240_000)).toBe('₹42.40 L');
    expect(formatMoney(9_300)).toBe('₹9,300');
    expect(parseAmountToCr(formatMoney(49_800_000))).toBe(4.98);
    expect(parseAmountToCr(formatMoney(4_240_000))).toBeCloseTo(0.424);
  });
  it('formats dates the way parseReleaseDate reads them', () => {
    expect(formatDate('2026-09-26')).toBe('26 Sep 2026');
    expect(parseReleaseDate(`Released ${formatDate('2026-09-26')}`)?.getDate()).toBe(26);
  });
  it('counts run days in calendar days', () => {
    expect(dayNumber('2026-09-26', '2026-09-26')).toBe(1);
    expect(dayNumber('2026-10-01', '2026-09-26')).toBe(6);
  });
});

describe('movieState', () => {
  it('is live with box office today or yesterday', () => {
    expect(movieState({ first_date: '2026-09-01', last_date: '2026-09-28', advance_date: null }, TODAY)).toBe('live');
  });
  it('is final once box office stopped before yesterday', () => {
    expect(movieState({ first_date: '2026-09-01', last_date: '2026-09-20', advance_date: null }, TODAY)).toBe('final');
  });
  it('is advance before release, unknown if advance lapsed without release', () => {
    expect(movieState({ first_date: null, last_date: null, advance_date: '2026-10-02' }, TODAY)).toBe('advance');
    expect(movieState({ first_date: null, last_date: null, advance_date: '2026-09-20' }, TODAY)).toBe('unknown');
  });
});

describe('listedFromRow', () => {
  it('builds a live listing with India gross, today figure and day label', () => {
    const m = listedFromRow(row(), TODAY);
    expect(m).toMatchObject({
      slug: 'the-paradise',
      url: '/movie/the-paradise',
      state: 'live',
      dayLabel: 'Day 4',
      releaseText: 'Released 26 Sep 2026',
      genre: 'Telugu, Hindi, Tamil +1',
      grossLabel: 'India Gross',
      gross: '₹49.80 Cr',
      grossCr: 49.8,
      todayText: '₹4.98 Cr',
      updatedText: 'Upd 2026-09-29 18:53 IST'
    });
  });
  it('has no today figure when the latest data is from yesterday', () => {
    expect(listedFromRow(row({ last_date: '2026-09-28', latest: { date: '2026-09-28', gross: 1 } }), TODAY).todayText).toBeNull();
  });
  it('builds an advance listing from advance bookings', () => {
    const m = listedFromRow(
      row({ first_date: null, last_date: null, total_gross: 0, release_date: '2026-10-02', latest: null, best: null, advance_date: '2026-10-02', advance: { date: '2026-10-02', gross: 18_600_000 } }),
      TODAY
    );
    expect(m).toMatchObject({ state: 'advance', dayLabel: null, releaseText: 'Releasing 2 Oct 2026', grossLabel: 'Advance Gross', gross: '₹1.86 Cr', todayText: null });
  });
});

describe('detailsFromData', () => {
  const days = [day('boxoffice', '2026-09-26', 200_000_000), day('boxoffice', '2026-09-27', 100_000_000), day('advance', '2026-09-30', 10_000_000)];
  const cumulative = {
    states: [{ name: 'Telangana', ...figs(180_000_000, 1_200_000, 12, 3_000_000) }],
    cities: [['Hyderabad', 'Telangana', 150_000_000, 1_000_000, 10, 2_000_000, 0, 0]],
    chains: [],
    formats: [],
    languages: []
  };
  const d = detailsFromData(row(), days, cumulative, TODAY, '2026-09-29T00:00:00Z');

  it('produces tables the existing movie-page grouping understands', () => {
    const headings = groupTables(d.tables).map((g) => g.heading);
    expect(headings).toEqual(['Day-wise Collection', 'Day 1', 'Day 2', 'Cumulative', 'Advance 2026-09-30']);
    expect(categoryOf('Day 2')).toBe('day');
    const day1 = groupTables(d.tables).find((g) => g.heading === 'Day 1')!;
    expect(day1.tables.map((t) => t.label)).toEqual([
      'State-wise — Day 1',
      'Top Cities — Day 1',
      'Chain-wise — Day 1',
      'Language-wise — Day 1',
      'Format-wise — Day 1'
    ]);
  });

  it('writes exact rupee cells with a TOTAL row on the day-wise table', () => {
    const dw = d.tables.find((t) => t.label === 'Day-wise Collection')!;
    expect(dw.headers).toEqual(['Day', 'Date', 'Weekday', 'Gross (₹)', 'Tickets', 'Shows', 'Occupancy']);
    expect(dw.rows[0]).toMatchObject({ Day: 'Day 1', Date: '26 Sep 2026', Weekday: 'Sat', 'Gross (₹)': '20,00,00,000', Occupancy: '25.00%' });
    const total = dw.rows[dw.rows.length - 1];
    expect(total.__isTotal).toBe(true);
    expect(total['Gross (₹)']).toBe('30,00,00,000');
  });

  it('ranks top cities and keeps their state', () => {
    const cities = d.tables.find((t) => t.label === 'Top Cities — Day 1')!;
    expect(cities.headers.slice(0, 3)).toEqual(['#', 'City', 'State']);
    expect(cities.rows[0]).toMatchObject({ '#': '1', City: 'Hyderabad', State: 'Telangana', 'Gross (₹)': '10,00,00,000' });
  });

  it('lines up two movies in the compare feature by state name', () => {
    const other = detailsFromData(row({ slug: 'other', title: 'Other', first_date: '2026-09-20', release_date: '2026-09-20' }), [day('boxoffice', '2026-09-20', 50_000_000)], null, TODAY);
    const t1 = d.tables.find((t) => t.label === 'State-wise — Day 1')!;
    const t2 = other.tables.find((t) => t.label === 'State-wise — Day 1')!;
    const merged = buildComparedTable([t1, t2]);
    expect(merged.nameColumn).toBe('State');
    expect(merged.rows.find((r) => r.name === 'Telangana')!.valuesByColumn['Gross (₹)']).toEqual(['12,00,00,000', '3,00,00,000']);
  });

  it('uses fixed stat labels and headline text', () => {
    expect(d.stats.map((s) => s.label)).toEqual(['India Gross', "Today's Gross", 'Best Day', 'Tickets Sold', 'Shows', 'Avg Occupancy', 'Advance Gross', 'Advance Tickets']);
    expect(d.stats.find((s) => s.label === 'Best Day')).toMatchObject({ value: '₹20.00 Cr', note: 'Day 1' });
    expect(d.headlineGross).toBe('₹49.80 Cr');
    expect(d.headlineLabel).toBe('India Gross · Day 4 running');
    expect(d.badgeText).toBe('Live Tracking · Day 4');
  });

  it('carries release/languages/formats meta and no source credit', () => {
    expect(d.meta.map((m) => m.label)).toEqual(['Released On', 'Languages', 'Formats']);
    expect(d.meta[0].value).toBe('26 Sep 2026');
  });

  it('handles a not-yet-released movie with only advance data', () => {
    const adv = detailsFromData(
      row({ first_date: null, last_date: null, total_gross: 0, latest: null, best: null, release_date: '2026-09-30' }),
      [day('advance', '2026-09-30', 10_000_000)],
      null,
      TODAY
    );
    expect(adv.state).toBe('advance');
    expect(adv.headlineLabel).toBe('Advance Gross · 30 Sep 2026');
    expect(adv.meta[0]).toMatchObject({ label: 'Releasing On', value: '30 Sep 2026' });
    expect(groupTables(adv.tables).map((g) => g.heading)).toEqual(['Advance 2026-09-30']);
  });
});

describe('premieres', () => {
  it('numbers a premieres-only first day as Day 0 when the database set a later release date', () => {
    const r = row({ first_date: '2026-09-23', premiere_date: '2026-09-23', release_date: '2026-09-24', last_date: '2026-09-29', best: { date: '2026-09-24', gross: 1 } });
    const d = detailsFromData(r, [day('boxoffice', '2026-09-23', 1_000_000), day('boxoffice', '2026-09-24', 5_000_000)], null, TODAY);
    const dw = d.tables.find((t) => t.label === 'Day-wise Collection')!;
    expect(dw.rows.slice(0, 2).map((x) => x.Day)).toEqual(['Day 0 (Pre-release)', 'Day 1']);
    expect(groupTables(d.tables).map((g) => g.heading).slice(0, 3)).toEqual(['Day-wise Collection', 'Day 0', 'Day 1']);
    expect(d.stats.find((s) => s.label === 'Best Day')!.note).toBe('Day 1');
    expect(listedFromRow(r, TODAY)).toMatchObject({ dayLabel: 'Day 6', releaseText: 'Released 24 Sep 2026' });
  });
});

describe('correctness labels', () => {
  it('never presents a film released before 2025 as lifetime or with invented Day numbers', () => {
    const r = row({ carried_over: true, first_date: '2025-01-01', release_date: null, last_date: '2025-03-01', days_tracked: 60, total_gross: 795_700_000 });
    const m = listedFromRow(r, TODAY);
    expect(m).toMatchObject({ state: 'final', grossLabel: 'Gross since 1 Jan 2025', releaseText: null, dayLabel: null, gross: '₹79.57 Cr' });
    const d = detailsFromData(r, [day('boxoffice', '2025-01-01', 1_000_000), day('boxoffice', '2025-01-02', 1_000_000)], null, TODAY);
    expect(d.headlineLabel).toBe('Gross since 1 Jan 2025 · released earlier');
    expect(d.stats[0].label).toBe('Gross since 1 Jan 2025');
    expect(d.meta[0]).toMatchObject({ label: 'Released', value: 'Before 1 Jan 2025 (figures shown are from 1 Jan 2025)' });
    const dw = d.tables.find((t) => t.label === 'Day-wise Collection')!;
    expect(dw.rows[0].Day).toBe('');
    expect(groupTables(d.tables).some((g) => /^Day \d+$/.test(g.heading))).toBe(false);
  });

  it('labels stray shows before Day 1 as pre-release, keeps them in the total, and gives them no report', () => {
    const r = row({ first_date: '2026-03-14', release_date: '2026-03-18', last_date: '2026-09-29' });
    const d = detailsFromData(r, [day('boxoffice', '2026-03-14', 100), day('boxoffice', '2026-03-18', 1_000_000), day('boxoffice', '2026-03-19', 2_000_000)], null, TODAY);
    const dw = d.tables.find((t) => t.label === 'Day-wise Collection')!;
    expect(dw.rows.map((x) => x.Day)).toEqual(['Pre-release', 'Day 1', 'Day 2', 'TOTAL']);
    expect(dw.rows[3]['Gross (₹)']).toBe('30,00,100');
    expect(groupTables(d.tables).map((g) => g.heading)).toEqual(['Day-wise Collection', 'Day 1', 'Day 2']);
  });

  it('describes a finished run by days with shows, not calendar span', () => {
    const r = row({ first_date: '2026-03-18', release_date: '2026-03-18', last_date: '2026-08-10', days_tracked: 110, advance: null, advance_date: null });
    expect(listedFromRow(r, TODAY)).toMatchObject({ state: 'final', dayLabel: '110 days' });
    expect(detailsFromData(r, [], null, TODAY).headlineLabel).toBe('India Gross · Final · 110 days with shows');
  });
});
