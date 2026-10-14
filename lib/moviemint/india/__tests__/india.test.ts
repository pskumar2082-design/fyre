import { describe, expect, it } from 'vitest';
import { MmiDateMismatch, MmiFormatError, parseAdvanceList, parseMoviePage, parseSitemapMovieIds, parseTrackedEntries } from '../parse';
import { cumulativeReport, isFinalDay, mergeTotals, movieRow, pageRows, reconcileWindow, snapshotRow, territoryTotal, toBreakdown, type StoredDay } from '../normalize';
import { allocateSlug, planLinks, type FyreEntry, type LinkRow, type MmEntry } from '../link';
import { planTasks, type LinkedMovie, type StoredState } from '../plan';
import { city, flightHtml, moviePage, notFoundPage, stateRow, type SeriesPoint } from './fixtures';

const pt = (date: string, gross: number, extra: Partial<SeriesPoint> = {}): SeriesPoint => ({
  date,
  gross,
  ticketsSold: Math.round(gross / 200),
  shows: 100,
  avgOccupancy: 30,
  lastUpdated: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)} 23:40 IST`,
  totalSeats: Math.round(gross / 60),
  ...extra
});

const hyd = city('Hyderabad', 'Telangana', 600_000, { tradeRegion: 'Nizam', tradeDistrict: 'Hyderabad', formats: [{ name: '2D', gross: 400_000 }, { name: 'IMAX 2D', gross: 200_000 }] });
const vij = city('Vijayawada', 'Andhra Pradesh', 300_000, { tradeRegion: 'Krishna', tradeDistrict: 'NTR' });
const che = city('Chennai', 'Tamil Nadu', 100_000);
const summary = { totalGross: 1_000_000, totalShows: 30, totalTicketsSold: 5000, totalSeats: 6000, totalLocations: 9, avgOccupancy: 83.33, totalFastFilling: 3, totalHouseFull: 0 };
const dayBlock = (date: string, lastUpdated: string, over: Partial<typeof summary> = {}) => ({
  date,
  lastUpdated,
  summary: { ...summary, ...over },
  indiaStates: [stateRow('Telangana', [hyd]), stateRow('Andhra Pradesh', [vij]), stateRow('Tamil Nadu', [che])],
  indiaLanguages: [
    { language: 'Telugu', gross: 900_000, shows: 25, ticketsSold: 4500, cities: 2, occupancy: 80 },
    { language: 'Tamil', gross: 100_000, shows: 5, ticketsSold: 500, cities: 1, occupancy: 50 }
  ],
  indiaFormats: [{ format: 'Standard', gross: 1_000_000, shows: 30, ticketsSold: 5000, cities: 3, occupancy: 83.33 }],
  indiaTerritories: [
    { name: 'Nizam', subRegion: false, gross: 600_000, shows: 10, ticketsSold: 3000, totalSeats: 2000, venues: 3, occupancy: 25, fastFilling: 1, houseFull: 0 },
    { name: 'Nizam / Hyderabad', subRegion: true, gross: 450_000, shows: 7, ticketsSold: 2200, totalSeats: 1400, venues: 2, occupancy: 30, fastFilling: 1, houseFull: 0 },
    { name: 'Andhra', subRegion: false, gross: 300_000, shows: 10, ticketsSold: 1500, totalSeats: 2000, venues: 3, occupancy: 25, fastFilling: 1, houseFull: 0 }
  ]
});

const series = [pt('20260923', 200_000), pt('20260924', 1_000_000), pt('20260925', 800_000), pt('20260927', 500_000)];
const ctx = { slug: 'test-movie', moviemintId: 'test-movie', title: 'Test Movie', now: '2026-10-14T05:00:00Z', today: '2026-10-14' };

describe('parseMoviePage', () => {
  it('reads config, the day series, the selected day and its breakdowns', () => {
    const html = moviePage({ movieId: 'test-movie', series, day: dayBlock('20260924', '2026-09-24 23:41 IST') });
    const p = parseMoviePage(html, 'test-movie', 'boxoffice');
    expect(p.series.map((s) => s.date)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-27']);
    expect(p.series[1]).toMatchObject({ gross: 1_000_000, sold: 5000, shows: 100, occupancy: 30 });
    expect(p.releaseDate).toBe('2026-09-24');
    expect(p.meta).toMatchObject({ backdrop: 'https://image.tmdb.org/t/p/w1280/b.jpg', genres: ['Action', 'Drama'], tmdbId: 1234 });
    expect(p.badge).toBeNull();
    expect(p.day?.date).toBe('2026-09-24');
    expect(p.day?.summary).toMatchObject({ gross: 1_000_000, sold: 5000, shows: 30, seats: 6000, venues: 9, ff: 3, hf: 0, cities: 3, states: 3, occupancy: 83.33 });
    expect(p.day?.summaryRaw).toMatchObject({ totalGross: 1_000_000, avgOccupancy: 83.33 });
    expect(p.day?.cities.map((c) => c.name)).toEqual(['Hyderabad', 'Vijayawada', 'Chennai']);
    expect(p.day?.cities[0]).toMatchObject({ tradeRegion: 'Nizam', tradeDistrict: 'Hyderabad', formats: [{ name: '2D', gross: 400_000 }, { name: 'IMAX 2D', gross: 200_000 }] });
    expect(p.day?.languages.map((l) => [l.name, l.gross, l.seats, l.occupancy])).toEqual([
      ['Telugu', 900_000, null, 80],
      ['Tamil', 100_000, null, 50]
    ]);
    expect(p.day?.territories.map((t) => [t.name, t.subRegion])).toEqual([
      ['Nizam', false],
      ['Nizam / Hyderabad', true],
      ['Andhra', false]
    ]);
    // MovieMint's chain / theatre lists are empty -> reported, never filled
    expect(p.day?.chainsAvailable).toBe(false);
    expect(p.day?.source).toBe('BookMyShow');
    expect(p.unknown).toEqual([]);
  });

  it('reads an advance page (no day series)', () => {
    const html = moviePage({ movieId: 'jailer-x', kind: 'advance', day: dayBlock('20261015', '2026-10-14 10:03 IST'), availableDates: ['20261015', '20261016'] });
    const p = parseMoviePage(html, 'jailer-x', 'advance');
    expect(p.series).toEqual([]);
    expect(p.day?.date).toBe('2026-10-15');
    expect(p.availableDates).toEqual(['2026-10-15', '2026-10-16']);
  });

  it('reads the live day: completed-as-of time', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20261014', '2026-10-14 20:40 IST'), completedAsOf: '20:40 IST' }), 'test-movie', 'boxoffice');
    expect(p.completedMode).toBe(true);
    expect(p.completedAsOf).toBe('20:40 IST');
  });

  it('release day before any show finished: empty series, no rows, no snapshot', () => {
    const html = moviePage({
      movieId: 'jailer-x',
      day: dayBlock('20261015', '2026-10-15 01:39 IST', { totalGross: 0, totalShows: 0, totalTicketsSold: 0, totalSeats: 0, totalLocations: 0 }),
      propsExtra: { dailySeries: undefined, todayDate: undefined, advanceHref: undefined, trackedHref: '$undefined' }
    });
    const p = parseMoviePage(html, 'jailer-x', 'boxoffice');
    expect(p.series).toEqual([]);
    expect(pageRows(p, { ...ctx, today: '2026-10-15' }, new Map())).toEqual([]);
    expect(snapshotRow(p, { ...ctx, today: '2026-10-15' })).toBeNull();
    // a box-office page that lost its series without that layout is still a format change
    expect(() => parseMoviePage(moviePage({ movieId: 'jailer-x', propsExtra: { dailySeries: undefined } }), 'jailer-x', 'boxoffice')).toThrow(/no daily series/);
  });

  it('refuses a page for another movie or without a movie config', () => {
    const html = moviePage({ movieId: 'other-movie', series });
    expect(() => parseMoviePage(html, 'test-movie', 'boxoffice')).toThrow(MmiFormatError);
    expect(() => parseMoviePage('<html>404</html>', 'test-movie', 'boxoffice')).toThrow(/no movie config/);
  });

  it('unknown-field detector: new MovieMint fields are reported, not dropped silently', () => {
    const html = moviePage({
      movieId: 'test-movie',
      series: [{ ...pt('20260924', 1_000_000), netGross: 1 } as any],
      day: { ...dayBlock('20260924', '2026-09-24 23:41 IST'), chainBreakdown: [{ name: 'PVR' }] },
      configExtra: { director: 'X' },
      propsExtra: { weekendSplit: [] },
      dataExtra: { indiaChains: [] }
    });
    const p = parseMoviePage(html, 'test-movie', 'boxoffice');
    expect(p.unknown).toEqual(['config.director', 'data.chainBreakdown (now carries rows)', 'data.indiaChains', 'page.weekendSplit', 'series.netGross']);
    expect(p.day?.chainsAvailable).toBe(true);
  });
});

describe('date validation (MovieMint silently answers with another date)', () => {
  it('missing date: "Movie Not Found" for a dated request is a mismatch, not a format error', () => {
    expect(() => parseMoviePage(notFoundPage(), 'test-movie', 'boxoffice', '2026-07-01')).toThrow(MmiDateMismatch);
    // undated request: the movie itself is not there
    expect(() => parseMoviePage(notFoundPage(), 'test-movie', 'boxoffice')).toThrow(MmiFormatError);
  });

  it('silent fallback: asked for one date, got another -> MmiDateMismatch, nothing returned', () => {
    const html = moviePage({ movieId: 'test-movie', series, day: dayBlock('20261014', '2026-10-14 12:00 IST') });
    try {
      parseMoviePage(html, 'test-movie', 'boxoffice', '2026-10-02');
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(MmiDateMismatch);
      expect((e as MmiDateMismatch).requested).toBe('2026-10-02');
      expect((e as MmiDateMismatch).returned).toBe('2026-10-14');
    }
    // the date actually asked for passes
    expect(parseMoviePage(html, 'test-movie', 'boxoffice', '2026-10-14').day?.date).toBe('2026-10-14');
  });

  it('cumulative request must come back as the cumulative report', () => {
    const cum = moviePage({ movieId: 'test-movie', series, day: dayBlock('cumulative', '2026-10-14 12:00 IST') });
    expect(parseMoviePage(cum, 'test-movie', 'boxoffice', 'cumulative').day?.date).toBe('cumulative');
    const fallback = moviePage({ movieId: 'test-movie', series, day: dayBlock('20261014', '2026-10-14 12:00 IST') });
    expect(() => parseMoviePage(fallback, 'test-movie', 'boxoffice', 'cumulative')).toThrow(MmiDateMismatch);
  });
});

describe('normalize', () => {
  it('series totals for every window date; breakdown only for the selected date', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20260924', '2026-09-24 23:41 IST') }), 'test-movie', 'boxoffice');
    const rows = pageRows(p, ctx, new Map());
    expect(rows.map((r) => r.date)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-27']);
    expect(rows.every((r) => r.day_window === 'tracked')).toBe(true);
    expect(rows.filter((r) => r.breakdown).map((r) => r.date)).toEqual(['2026-09-24']);
    const d = rows[1];
    expect(d.breakdown_status).toBe('final');
    // gross/tickets/shows from the series, extras from the same date's block
    expect(d.totals).toMatchObject({ gross: 1_000_000, sold: 5000, shows: 100, fastfilling: 3, venues: 9, cities: 3, states: 3, languages: ['Telugu', 'Tamil'], occupancySource: 30 });
    expect(d.breakdown?.cities[0]).toEqual(['Hyderabad', 'Telangana', 600_000, 3000, 10, 2000, 1, 0, 3, 'Nizam', 'Hyderabad', [['2D', 400_000], ['IMAX 2D', 200_000]], 25]);
    expect(d.breakdown?.chains).toEqual([]);
  });

  it('never adds a date MovieMint leaves out of its own series (a gap inside the window)', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20260926', '2026-09-26 23:40 IST') }), 'test-movie', 'boxoffice');
    const rows = pageRows(p, ctx, new Map());
    expect(rows.find((r) => r.date === '2026-09-26')).toBeUndefined();
  });

  it('later-day classification: a report after the window is a separate "later" row', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20261003', '2026-10-03 23:40 IST', { totalGross: 120_000, totalTicketsSold: 600 }) }), 'test-movie', 'boxoffice', '2026-10-03');
    const rows = pageRows(p, ctx, new Map());
    const later = rows.filter((r) => r.day_window === 'later');
    expect(later).toHaveLength(1);
    expect(later[0]).toMatchObject({ date: '2026-10-03', breakdown_status: 'final', totals: { gross: 120_000, sold: 600, totalSeats: 6000, occupancy: 10, occupancySource: 83.33 } });
    // window rows are untouched by it
    expect(rows.filter((r) => r.day_window === 'tracked').map((r) => r.date)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-27']);
  });

  it('keeps stored extras when a later series refresh lacks them', () => {
    const stored = { gross: 1_000_000, sold: 5000, shows: 100, totalSeats: 6000, fastfilling: 3, venues: 9, cities: 3, states: 3, languages: ['Telugu'], formats: ['Standard'] };
    const t = mergeTotals({ date: '2026-09-24', gross: 1_000_000, sold: 5000, shows: 100, seats: null, occupancy: 83.3, lastUpdated: null }, null, stored);
    expect(t).toMatchObject({ totalSeats: 6000, fastfilling: 3, venues: 9, languages: ['Telugu'], occupancy: 83.33, occupancySource: 83.3 });
    // a different ticket count = a different moment: old seat count not reused
    const t2 = mergeTotals({ date: '2026-09-24', gross: 1_100_000, sold: 5500, shows: 100, seats: null, occupancy: 80, lastUpdated: null }, null, stored);
    expect(t2.totalSeats).toBeNull();
    expect(t2.occupancy).toBeNull(); // Fyre never computes without seats
    expect(t2.occupancySource).toBe(80); // MovieMint's own figure kept separately
  });

  it('missing stays missing: absent figures are null, never zero', () => {
    const t = mergeTotals({ date: '2026-09-24', gross: 10, sold: 1, shows: 1, seats: null, occupancy: null, lastUpdated: null }, null, null);
    expect(t).toMatchObject({ totalSeats: null, fastfilling: null, housefull: null, venues: null, cities: null, states: null, occupancy: null, occupancySource: null });
  });

  it('live vs final day blocks', () => {
    expect(isFinalDay('boxoffice', '2026-10-14', '2026-10-14', '2026-10-14 10:03 IST')).toBe(false);
    expect(isFinalDay('boxoffice', '2026-10-13', '2026-10-14', '2026-10-13 23:40 IST')).toBe(true);
    expect(isFinalDay('boxoffice', '2026-10-13', '2026-10-14', '2026-10-13 18:00 IST')).toBe(false);
    expect(isFinalDay('boxoffice', '2026-10-12', '2026-10-14', '2026-10-12 18:00 IST')).toBe(true);
    expect(isFinalDay('advance', '2026-10-10', '2026-10-14', null)).toBe(false);
  });

  it('source occupancy and computed occupancy are kept apart', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20260924', '2026-09-24 23:41 IST') }), 'test-movie', 'boxoffice');
    const b = toBreakdown(p.day!);
    expect(b.languages[0]).toMatchObject({ name: 'Telugu', totalSeats: null, occupancy: null, occupancySource: 80, venues: null });
    expect(b.states[0]).toMatchObject({ name: 'Telangana', totalSeats: 2000, occupancy: 150, occupancySource: 25 });
  });

  it('city x format split: per-city format gross at tuple position 11', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20260924', '2026-09-24 23:41 IST') }), 'test-movie', 'boxoffice');
    const b = toBreakdown(p.day!);
    const hydRow = b.cities.find((c) => c[0] === 'Hyderabad')!;
    expect(hydRow[11]).toEqual([
      ['2D', 400_000],
      ['IMAX 2D', 200_000]
    ]);
    expect(hydRow[11].reduce((a, [, g]) => a + g, 0)).toBe(hydRow[2]);
    // positions 0-8 keep the bf_* layout every SQL helper reads
    expect(hydRow.slice(0, 9)).toEqual(['Hyderabad', 'Telangana', 600_000, 3000, 10, 2000, 1, 0, 3]);
  });

  it('nested AP/TS territories are never double-counted', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20260924', '2026-09-24 23:41 IST') }), 'test-movie', 'boxoffice');
    const b = toBreakdown(p.day!);
    expect(b.territories.map((t) => t.subRegion)).toEqual([false, true, false]);
    expect(territoryTotal(b.territories)).toEqual({ gross: 900_000, sold: 4500, shows: 20 });
  });

  const day = (date: string, gross: number, kind: 'boxoffice' | 'advance' = 'boxoffice', status: StoredDay['breakdown_status'] = 'none', window: 'tracked' | 'later' = 'tracked'): StoredDay => ({
    kind,
    date,
    totals: { gross, sold: gross / 200, shows: 10, totalSeats: gross / 50 },
    breakdown: { languages: [{ name: 'Telugu', gross } as any], formats: [] },
    breakdown_status: status,
    source_updated: `${date} 23:40 IST`,
    synced_at: `${date}T20:00:00Z`,
    day_window: window
  });
  const meta = { slug: 'test-movie', moviemintId: 'test-movie', title: 'Test Movie', poster: null, language: 'Telugu', releaseDate: '2026-09-24', availableDates: [] };

  it('movie summary: Day 1 from MovieMint, Day 0, gaps, totals', () => {
    const r = movieRow(meta, [day('2026-09-23', 200), day('2026-09-24', 1000, 'boxoffice', 'final'), day('2026-09-25', 800), day('2026-09-27', 500)], '2026-10-14');
    expect(r).toMatchObject({
      release_date: '2026-09-24',
      premiere_date: '2026-09-23',
      first_date: '2026-09-23',
      last_date: '2026-09-27',
      carried_over: false,
      days_tracked: 4,
      total_gross: 2500,
      missing_dates: ['2026-09-26'],
      breakdown_days: 1,
      languages: ['Telugu'],
      window_start: '2026-09-23',
      window_end: '2026-09-27',
      later_days: 0,
      later_gross: 0
    });
    expect(r.best).toMatchObject({ date: '2026-09-24', gross: 1000 });
    expect(r.latest).toMatchObject({ date: '2026-09-27' });
  });

  it('later days: kept apart from the official total, never labelled lifetime', () => {
    const r = movieRow(meta, [day('2026-09-24', 1000), day('2026-09-25', 800), day('2026-10-01', 90, 'boxoffice', 'final', 'later'), day('2026-10-03', 60, 'boxoffice', 'final', 'later')], '2026-10-14');
    expect(r).toMatchObject({ total_gross: 1800, days_tracked: 2, window_end: '2026-09-25', later_days: 2, later_gross: 150, later_first: '2026-10-01', later_last: '2026-10-03', last_date: '2026-10-03' });
    // gaps are counted inside the window only (the dates between window and later days are not "missing")
    expect(r.missing_dates).toEqual([]);
    expect(r.latest).toMatchObject({ date: '2026-10-03', window: 'later' });
    // last updated = the newest source stamp, whatever order rows were synced in
    expect(r.source_updated).toBe('2026-10-03 23:40 IST');
  });

  it('tracking that began after the release is a tracked period, not lifetime', () => {
    const r = movieRow({ ...meta, releaseDate: '2026-06-01' }, [day('2026-09-23', 200), day('2026-09-24', 300)], '2026-10-14');
    expect(r.carried_over).toBe(true);
    expect(r.release_date).toBeNull();
  });

  it('upcoming movie: release date and the release-day advance', () => {
    const r = movieRow({ ...meta, releaseDate: '2026-10-15' }, [day('2026-10-15', 900, 'advance'), day('2026-10-16', 400, 'advance')], '2026-10-14');
    expect(r).toMatchObject({ first_date: null, release_date: '2026-10-15', advance_date: '2026-10-16', days_tracked: 0 });
    expect(r.advance).toMatchObject({ date: '2026-10-15', gross: 900 });
  });

  it('empty state: movie with no collection data yet', () => {
    const r = movieRow(meta, [], '2026-10-14');
    expect(r).toMatchObject({ days_tracked: 0, total_gross: 0, latest: null, best: null, advance: null, first_date: null, window_start: null, later_days: 0, languages: ['Telugu'] });
  });
});

describe('snapshots (never fabricated)', () => {
  it('intraday: today\'s live report becomes a snapshot with its completed-as-of time', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20261014', '2026-10-14 20:40 IST'), completedAsOf: '20:40 IST' }), 'test-movie', 'boxoffice');
    const s = snapshotRow(p, ctx)!;
    expect(s).toMatchObject({ kind: 'boxoffice', show_date: '2026-10-14', source_updated: '2026-10-14 20:40 IST', completed_as_of: '20:40 IST' });
    expect(s.totals).toMatchObject({ gross: 1_000_000, sold: 5000, totalSeats: 6000, occupancy: 83.33, occupancySource: 83.33 });
    expect(s.states?.[0]).toEqual(['Telangana', 600_000, 3000, 10, 2000]);
  });

  it('a finished day is never a snapshot (one final value lives in mmi_movie_day)', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20260924', '2026-09-24 23:41 IST') }), 'test-movie', 'boxoffice');
    expect(snapshotRow(p, ctx)).toBeNull();
  });

  it('advance build-up: every advance refresh is a snapshot of that show date; empty advance is not', () => {
    const p = parseMoviePage(moviePage({ movieId: 'jailer-x', kind: 'advance', day: dayBlock('20261015', '2026-10-14 10:03 IST') }), 'jailer-x', 'advance');
    expect(snapshotRow(p, { ...ctx, slug: 'jailer-x', moviemintId: 'jailer-x' })).toMatchObject({ kind: 'advance', show_date: '2026-10-15', completed_as_of: null, source_updated: '2026-10-14 10:03 IST' });
    const empty = parseMoviePage(moviePage({ movieId: 'jailer-x', kind: 'advance', day: dayBlock('20261016', '2026-10-14 10:03 IST', { totalShows: 0, totalGross: 0 }) }), 'jailer-x', 'advance');
    expect(snapshotRow(empty, ctx)).toBeNull();
    expect(pageRows(empty, ctx, new Map())).toEqual([]);
  });
});

describe('cumulative report reconciliation', () => {
  it('stores the whole-window report and reconciles it with the series and the /tracked total', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('cumulative', '2026-10-14 12:00 IST', { totalGross: 2_500_000, totalLocations: 14 }) }), 'test-movie', 'boxoffice', 'cumulative');
    const c = cumulativeReport(p)!;
    expect(c.summary).toMatchObject({ gross: 2_500_000, venues: 14 });
    expect(c.dates).toEqual(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-27']);
    expect(pageRows(p, ctx, new Map()).filter((r) => r.breakdown)).toEqual([]); // never stored as a day
    const ok = reconcileWindow(p.series.map((s) => s.gross), c.summary.gross, 2_500_000);
    expect(ok).toMatchObject({ sum: 2_500_000, diffCumulative: 0, diffOfficial: 0, ok: true });
    const off = reconcileWindow(p.series.map((s) => s.gross), 2_600_000, null);
    expect(off).toMatchObject({ ok: false, diffCumulative: 100_000, diffOfficial: null });
    expect(reconcileWindow([1, 2], null, null)).toMatchObject({ checked: false, ok: true });
  });
});

describe('catalog link', () => {
  const key = (t: string) => t.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  const mm = (id: string, title: string, releaseDate: string | null = '2026-10-02', language: string | null = 'Telugu'): MmEntry => ({ id, title, releaseDate, language, badge: null });
  const fy = (movieId: string, slug: string | null, title: string, extra: Partial<FyreEntry> = {}): FyreEntry => ({
    movieId,
    slug,
    title,
    origin: 'moviemint',
    releaseDate: '2026-10-02',
    firstSourceDate: null,
    languages: ['Telugu'],
    ...extra
  });

  it('keeps an existing Fyre movie and its public URL', () => {
    const plan = planLinks([mm('the-paradise', 'The Paradise')], [fy('the-paradise', 'the-paradise', 'The Paradise')], [], new Set(['the-paradise']), key);
    expect(plan[0]).toMatchObject({ action: 'link', method: 'same_id', movieId: 'the-paradise', slug: 'the-paradise' });
  });

  it('attaches a BFILMY-created Fyre movie by title + date, keeping its id and URL', () => {
    const plan = planLinks(
      [mm('don-t-trouble-the-trouble', "Don't Trouble The Trouble")],
      [fy('fyre-1e7c787d', 'dont-trouble-the-trouble', "Don't Trouble The Trouble", { origin: 'bfilmy_usa' })],
      [],
      new Set(['dont-trouble-the-trouble']),
      key
    );
    expect(plan[0]).toMatchObject({ action: 'link', method: 'title_date', movieId: 'fyre-1e7c787d', slug: 'dont-trouble-the-trouble' });
  });

  it('matches an alternate title recorded for the Fyre movie', () => {
    const plan = planLinks([mm('rajini-the-jailer-2', 'Jailer 2', '2026-10-15', 'Tamil')], [fy('fyre-aa', 'jailer-2', 'Rajini: The Jailer 2', { origin: 'bfilmy_india', releaseDate: '2026-10-15', languages: ['Tamil', 'Hindi'], titles: ['Jailer 2'] })], [], new Set(['jailer-2']), key);
    expect(plan[0]).toMatchObject({ action: 'link', movieId: 'fyre-aa', slug: 'jailer-2' });
  });

  it('sends ambiguous or conflicting matches to review', () => {
    const two = planLinks([mm('hi', 'Hi')], [fy('fyre-1', 'hi', 'Hi', { origin: 'bfilmy_india' }), fy('fyre-2', 'hi-2026', 'Hi', { origin: 'bfilmy_india' })], [], new Set(['hi', 'hi-2026']), key);
    expect(two[0]).toMatchObject({ action: 'review', movieId: null });
    const far = planLinks([mm('dc', 'DC', '2026-03-01')], [fy('fyre-3', 'dc', 'DC', { origin: 'bfilmy_india', releaseDate: '2026-08-01' })], [], new Set(['dc']), key);
    expect(far[0]).toMatchObject({ action: 'review', note: expect.stringMatching(/days apart/) });
    const lang = planLinks([mm('x', 'X Movie', '2026-10-02', 'Japanese')], [fy('fyre-4', 'x-movie', 'X Movie', { origin: 'bfilmy_india', languages: ['Hindi'] })], [], new Set(['x-movie']), key);
    expect(lang[0]).toMatchObject({ action: 'review', note: expect.stringMatching(/language/) });
  });

  it('creates a Fyre movie for a MovieMint movie Fyre does not have, with a free slug', () => {
    const plan = planLinks([mm('comrade-kalyan', 'Comrade Kalyan', '2026-10-09')], [fy('peddi', 'comrade-kalyan', 'Peddi')], [], new Set(['comrade-kalyan']), key);
    expect(plan[0]).toMatchObject({ action: 'create', movieId: 'comrade-kalyan', slug: 'comrade-kalyan-2026' });
  });

  it('never links a BFILMY-only movie (it is simply not in the MovieMint plan)', () => {
    const plan = planLinks([mm('a', 'Alpha')], [fy('a', 'a', 'Alpha'), fy('fyre-only', 'thudakkam', 'Thudakkam', { origin: 'bfilmy_india' })], [], new Set(['a', 'thudakkam']), key);
    expect(plan.map((p) => p.movieId)).toEqual(['a']);
  });

  it('respects admin decisions and exclusions', () => {
    const existing: LinkRow[] = [
      { moviemint_id: 'a', movie_id: 'fyre-x', slug: 'custom', link_status: 'linked', link_method: 'admin' },
      { moviemint_id: 'b', movie_id: null, slug: null, link_status: 'excluded', link_method: 'admin' }
    ];
    const plan = planLinks([mm('a', 'Alpha'), mm('b', 'Beta')], [fy('a', 'a', 'Alpha'), fy('fyre-x', 'custom', 'Alpha')], existing, new Set(['a', 'custom']), key);
    expect(plan.map((p) => p.action)).toEqual(['keep', 'keep']);
  });

  it('slug allocation', () => {
    expect(allocateSlug(mm('hi', 'Hi', '2026-01-01'), new Set())).toBe('hi');
    expect(allocateSlug(mm('hi', 'Hi', '2026-01-01'), new Set(['hi']))).toBe('hi-2026');
    expect(allocateSlug(mm('hi', 'Hi', '2026-01-01'), new Set(['hi', 'hi-2026']))).toBe('hi-2');
  });
});

describe('page plan', () => {
  const now = Date.parse('2026-10-14T06:00:00Z');
  const today = '2026-10-14';
  const movie = (id: string, extra: Partial<LinkedMovie> = {}): LinkedMovie => ({
    moviemintId: id,
    movieId: id,
    slug: id,
    title: id,
    poster: null,
    language: 'Telugu',
    releaseDate: '2026-10-02',
    onList: true,
    onAdvance: false,
    lastTrackedDate: '2026-10-13',
    stopped: false,
    ...extra
  });
  const st = (o: Partial<StoredState>): StoredState => ({ availableDates: [], finalDates: new Set(), laterFinal: new Set(), windowEnd: null, latestSnapshot: null, advanceDates: [], lastDate: null, ...o });
  const label = (t: { reason: string; movieId: string; date: string | null }) => `${t.reason}:${t.movieId}:${t.date ?? ''}`;

  it('live views, advance (every open show date), first fetches, cumulative, finals newest first, later probes', () => {
    const movies = [
      movie('run', { onAdvance: true }),
      movie('soon', { releaseDate: '2026-10-15', lastTrackedDate: null, onList: false, onAdvance: true }),
      movie('old', { releaseDate: '2026-06-01', lastTrackedDate: '2026-07-01' }),
      movie('quiet'), // running, no advance sales listed -> no advance page
      movie('tail', { onList: false, releaseDate: '2026-09-01', lastTrackedDate: '2026-09-20' }) // window over, MovieMint still captures it
    ];
    const stored = new Map([
      ['run', st({ availableDates: ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'], finalDates: new Set(['2026-10-11']), windowEnd: '2026-10-14', lastDate: '2026-10-14' })],
      ['soon', st({ advanceDates: ['2026-10-15', '2026-10-16'] })],
      ['old', st({ availableDates: ['2026-06-01'], windowEnd: '2026-06-01', lastDate: '2026-07-01' })],
      ['tail', st({ availableDates: ['2026-10-10'], finalDates: new Set(['2026-10-10']), windowEnd: '2026-10-10', latestSnapshot: '2026-10-14', laterFinal: new Set(['2026-10-11', '2026-10-12']) })]
    ]);
    const fetched = new Map([
      ['old|cumulative', { at: now - 90 * 86_400_000, ok: true }],
      ['tail|cumulative', { at: now - 9 * 86_400_000, ok: true }],
      ['tail|series', { at: now - 30 * 60_000, ok: true }]
    ]);
    const tasks = planTasks(movies, fetched, stored, now, today);
    expect(tasks.map(label)).toEqual([
      'series_active:run:',
      'series_active:quiet:',
      'advance:soon:',
      'advance:soon:2026-10-15',
      'advance:soon:2026-10-16',
      'advance:run:',
      'series_first:old:',
      'cumulative:run:cumulative',
      'date_final:run:2026-10-13',
      'date_final:run:2026-10-12',
      'date_final:old:2026-06-01',
      'later_probe:tail:2026-10-13'
    ]);
  });

  it('a date MovieMint answered as missing is not asked again for a week; other failures retry after 6 hours', () => {
    const stored = new Map([['tail', st({ availableDates: ['2026-09-20'], finalDates: new Set(['2026-09-20']), windowEnd: '2026-09-20', latestSnapshot: '2026-09-24' })]]);
    const m = [movie('tail', { onList: false, lastTrackedDate: '2026-09-20' })];
    const fetched = new Map([
      ['tail|series', { at: now - 60_000, ok: true }],
      ['tail|cumulative', { at: now - 60_000, ok: true }],
      ['tail|date:2026-09-21', { at: now - 3 * 86_400_000, ok: false, error: 'missing: MovieMint returned 2026-10-14 for 2026-09-21' }],
      ['tail|date:2026-09-22', { at: now - 25 * 3600_000, ok: false, error: 'HTTP 500' }],
      ['tail|date:2026-09-23', { at: now - 3 * 3600_000, ok: false, error: 'timeout' }]
    ]);
    expect(planTasks(m, fetched, stored, now, today).map(label)).toEqual(['later_probe:tail:2026-09-24', 'later_probe:tail:2026-09-22']);
  });

  it('a fetched movie without a stored summary is fetched again (self-heals an interrupted run)', () => {
    const fetched = new Map([['done|series', { at: now - 3 * 86_400_000, ok: true }], ['old|series', { at: now - 3 * 86_400_000, ok: true }]]);
    const stored = new Map([['done', st({ availableDates: ['2026-07-01'], finalDates: new Set(['2026-07-01']), windowEnd: '2026-07-01' })]]);
    const ms = [movie('done', { lastTrackedDate: '2026-07-01', releaseDate: '2026-07-01' }), movie('old', { lastTrackedDate: '2026-07-01', releaseDate: '2026-07-01' })];
    expect(planTasks(ms, new Map([...fetched, ['done|cumulative', { at: now, ok: true }]]), stored, now, today).map(label)).toEqual(['series_first:old:']);
  });

  it('respects freshness, recent failures and stopped movies', () => {
    const fetched = new Map([
      ['run|series', { at: now - 10 * 60_000, ok: true }],
      ['run|advance', { at: now - 60 * 60_000, ok: false }]
    ]);
    const tasks = planTasks([movie('run', { onAdvance: true }), movie('stop', { stopped: true })], fetched, new Map(), now, today);
    expect(tasks).toEqual([]);
  });

  it('archive start: no final report requested before 2026-06-01, whatever the window', () => {
    const stored = new Map([['old', st({ availableDates: ['2026-05-30', '2026-05-31', '2026-06-01'], windowEnd: '2026-06-01' })]]);
    const fetched = new Map([
      ['old|series', { at: now - 86_400_000, ok: true }],
      ['old|cumulative', { at: now - 86_400_000, ok: true }]
    ]);
    const tasks = planTasks([movie('old', { lastTrackedDate: '2026-06-01', releaseDate: '2026-05-30' })], fetched, stored, now, today);
    expect(tasks.map(label)).toEqual(['date_final:old:2026-06-01']);
  });
});

describe('lists', () => {
  it('advance list: every listing once, with its published entry', () => {
    const cfg = (movieId: string, releaseDate: string, rank: number) =>
      `["$","$L1e","${movieId}",{"config":${JSON.stringify({ movieId, title: movieId.toUpperCase(), releaseDate, language: 'Tamil', region: 'india', badge: '$undefined', poster: 'p' })},"summary":{"totalGross":1},"topRegion":"Tamil Nadu","rank":${rank}}]`;
    const html = flightHtml(`9:[${cfg('jailer-2', '2026-10-15', 1)},${cfg('desu7', '2026-10-16', 2)},${cfg('jailer-2', '2026-10-15', 1)}]`);
    const list = parseAdvanceList(html);
    expect(list.map(({ entry: _e, ...r }) => r)).toEqual([
      { id: 'jailer-2', title: 'JAILER-2', language: 'Tamil', releaseDate: '2026-10-15', poster: 'p', badge: null },
      { id: 'desu7', title: 'DESU7', language: 'Tamil', releaseDate: '2026-10-16', poster: 'p', badge: null }
    ]);
    expect(list[1].entry).toMatchObject({ list: 'advance', summary: { totalGross: 1 }, topRegion: 'Tamil Nadu', rank: 2 });
  });

  it('tracked list entries are kept whole', () => {
    const html = flightHtml(`3:[{"boxOfficeId":"the-paradise","title":"The Paradise","gross":250000000.5,"ticketsSold":900000,"topState":"Telangana","badge":"$undefined"},{"boxOfficeId":"the-paradise","title":"dup"}]`);
    expect(parseTrackedEntries(html).get('the-paradise')).toEqual({ list: 'tracked', boxOfficeId: 'the-paradise', title: 'The Paradise', gross: 250000000.5, ticketsSold: 900000, topState: 'Telangana', badge: null });
  });

  it('sitemap: movie ids only', () => {
    const xml = `<urlset><url><loc>https://moviemintbo.com/movie/hanuman-ansh</loc></url><url><loc>https://moviemintbo.com/tracked</loc></url><url><loc>https://moviemintbo.com/movie/desu7</loc></url><url><loc>https://moviemintbo.com/movie/desu7</loc></url></urlset>`;
    expect(parseSitemapMovieIds(xml)).toEqual(['desu7', 'hanuman-ansh']);
  });
});
