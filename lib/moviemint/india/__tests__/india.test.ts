import { describe, expect, it } from 'vitest';
import { MmiFormatError, parseMoviePage } from '../parse';
import { isFinalDay, mergeTotals, movieRow, pageRows, toBreakdown, type StoredDay } from '../normalize';
import { allocateSlug, planLinks, type FyreEntry, type LinkRow, type MmEntry } from '../link';
import { planTasks, type LinkedMovie } from '../plan';
import { city, moviePage, stateRow, type SeriesPoint } from './fixtures';

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

const hyd = city('Hyderabad', 'Telangana', 600_000);
const vij = city('Vijayawada', 'Andhra Pradesh', 300_000);
const che = city('Chennai', 'Tamil Nadu', 100_000);
const dayBlock = (date: string, lastUpdated: string) => ({
  date,
  lastUpdated,
  summary: { totalGross: 1_000_000, totalShows: 30, totalTicketsSold: 5000, totalSeats: 6000, totalLocations: 9, avgOccupancy: 83.33, totalFastFilling: 3, totalHouseFull: 0 },
  indiaStates: [stateRow('Telangana', [hyd]), stateRow('Andhra Pradesh', [vij]), stateRow('Tamil Nadu', [che])],
  indiaLanguages: [
    { language: 'Telugu', gross: 900_000, shows: 25, ticketsSold: 4500, cities: 2, occupancy: 80 },
    { language: 'Tamil', gross: 100_000, shows: 5, ticketsSold: 500, cities: 1, occupancy: 50 }
  ],
  indiaFormats: [{ format: 'Standard', gross: 1_000_000, shows: 30, ticketsSold: 5000, cities: 3, occupancy: 83.33 }],
  indiaTerritories: [{ name: 'Nizam', subRegion: false, gross: 600_000, shows: 10, ticketsSold: 3000, totalSeats: 2000, venues: 3, occupancy: 25, fastFilling: 1, houseFull: 0 }]
});

const series = [pt('20260923', 200_000), pt('20260924', 1_000_000), pt('20260925', 800_000), pt('20260927', 500_000)];

describe('parseMoviePage', () => {
  it('reads the day series, the selected day and its breakdowns', () => {
    const html = moviePage({ movieId: 'test-movie', series, day: dayBlock('20260924', '2026-09-24 23:41 IST') });
    const p = parseMoviePage(html, 'test-movie', 'boxoffice');
    expect(p.series.map((s) => s.date)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-27']);
    expect(p.series[1]).toMatchObject({ gross: 1_000_000, sold: 5000, shows: 100 });
    expect(p.releaseDate).toBe('2026-09-24');
    expect(p.day?.date).toBe('2026-09-24');
    expect(p.day?.summary).toMatchObject({ gross: 1_000_000, sold: 5000, shows: 30, seats: 6000, venues: 9, ff: 3, hf: 0, cities: 3, states: 3 });
    expect(p.day?.cities.map((c) => c.name)).toEqual(['Hyderabad', 'Vijayawada', 'Chennai']);
    expect(p.day?.languages.map((l) => [l.name, l.gross, l.seats])).toEqual([
      ['Telugu', 900_000, null],
      ['Tamil', 100_000, null]
    ]);
    expect(p.day?.territories[0]).toMatchObject({ name: 'Nizam', subRegion: false });
    // MovieMint's chain / theater lists are empty -> reported, never filled
    expect(p.day?.chainsAvailable).toBe(false);
    expect(p.day?.source).toBe('BookMyShow');
  });

  it('reads an advance page (no day series)', () => {
    const html = moviePage({ movieId: 'jailer-x', kind: 'advance', day: dayBlock('20261015', '2026-10-14 10:03 IST'), availableDates: ['20261015', '20261016'] });
    const p = parseMoviePage(html, 'jailer-x', 'advance');
    expect(p.series).toEqual([]);
    expect(p.day?.date).toBe('2026-10-15');
    expect(p.availableDates).toEqual(['2026-10-15', '2026-10-16']);
  });

  it('refuses a page for another movie or without a movie config', () => {
    const html = moviePage({ movieId: 'other-movie', series });
    expect(() => parseMoviePage(html, 'test-movie', 'boxoffice')).toThrow(MmiFormatError);
    expect(() => parseMoviePage('<html>404</html>', 'test-movie', 'boxoffice')).toThrow(/no movie config/);
  });
});

describe('normalize', () => {
  const ctx = { slug: 'test-movie', moviemintId: 'test-movie', title: 'Test Movie', now: '2026-10-14T05:00:00Z', today: '2026-10-14' };

  it('series totals for every MovieMint date; breakdown only for the selected date', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20260924', '2026-09-24 23:41 IST') }), 'test-movie', 'boxoffice');
    const rows = pageRows(p, ctx, new Map());
    expect(rows.map((r) => r.date)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-27']);
    expect(rows.filter((r) => r.breakdown).map((r) => r.date)).toEqual(['2026-09-24']);
    const d = rows[1];
    expect(d.breakdown_status).toBe('final');
    // gross/tickets/shows from the series, extras from the same date's block
    expect(d.totals).toMatchObject({ gross: 1_000_000, sold: 5000, shows: 100, fastfilling: 3, venues: 9, cities: 3, states: 3, languages: ['Telugu', 'Tamil'] });
    expect(d.breakdown?.cities[0]).toEqual(['Hyderabad', 'Telangana', 600_000, 3000, 10, 2000, 1, 0, 3]);
    expect(d.breakdown?.chains).toEqual([]);
  });

  it('never adds a date MovieMint leaves out of its own series', () => {
    // selected date 2026-09-26 is not in the series (a below-threshold day)
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20260926', '2026-09-26 23:40 IST') }), 'test-movie', 'boxoffice');
    const rows = pageRows(p, ctx, new Map());
    expect(rows.find((r) => r.date === '2026-09-26')).toBeUndefined();
  });

  it('keeps stored extras when a later series refresh lacks them', () => {
    const stored = { gross: 1_000_000, sold: 5000, shows: 100, totalSeats: 6000, fastfilling: 3, venues: 9, cities: 3, states: 3, languages: ['Telugu'], formats: ['Standard'] };
    const t = mergeTotals({ date: '2026-09-24', gross: 1_000_000, sold: 5000, shows: 100, seats: null, occupancy: 83.3, lastUpdated: null }, null, stored);
    expect(t).toMatchObject({ totalSeats: 6000, fastfilling: 3, venues: 9, languages: ['Telugu'], occupancy: 83.33 });
    // a different ticket count = a different moment: old seat count not reused
    const t2 = mergeTotals({ date: '2026-09-24', gross: 1_100_000, sold: 5500, shows: 100, seats: null, occupancy: 80, lastUpdated: null }, null, stored);
    expect(t2.totalSeats).toBeNull();
    expect(t2.occupancy).toBe(80);
  });

  it('live vs final day blocks', () => {
    expect(isFinalDay('boxoffice', '2026-10-14', '2026-10-14', '2026-10-14 10:03 IST')).toBe(false);
    expect(isFinalDay('boxoffice', '2026-10-13', '2026-10-14', '2026-10-13 23:40 IST')).toBe(true);
    expect(isFinalDay('boxoffice', '2026-10-13', '2026-10-14', '2026-10-13 18:00 IST')).toBe(false);
    expect(isFinalDay('boxoffice', '2026-10-12', '2026-10-14', '2026-10-12 18:00 IST')).toBe(true);
    expect(isFinalDay('advance', '2026-10-10', '2026-10-14', null)).toBe(false);
  });

  it('breakdown keeps MovieMint occupancy where seats are not given', () => {
    const p = parseMoviePage(moviePage({ movieId: 'test-movie', series, day: dayBlock('20260924', '2026-09-24 23:41 IST') }), 'test-movie', 'boxoffice');
    const b = toBreakdown(p.day!);
    expect(b.languages[0]).toMatchObject({ name: 'Telugu', totalSeats: null, occupancy: 80, venues: null });
    expect(b.states[0]).toMatchObject({ name: 'Telangana', totalSeats: 2000, occupancy: 150 });
  });

  const day = (date: string, gross: number, kind: 'boxoffice' | 'advance' = 'boxoffice', status: StoredDay['breakdown_status'] = 'none'): StoredDay => ({
    kind,
    date,
    totals: { gross, sold: gross / 200, shows: 10, totalSeats: gross / 50 },
    breakdown: { languages: [{ name: 'Telugu', gross } as any], formats: [] },
    breakdown_status: status,
    source_updated: `${date} 23:40 IST`,
    synced_at: `${date}T20:00:00Z`
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
      languages: ['Telugu']
    });
    expect(r.best).toMatchObject({ date: '2026-09-24', gross: 1000 });
    expect(r.latest).toMatchObject({ date: '2026-09-27' });
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

  it('movie with no collection data yet', () => {
    const r = movieRow(meta, [], '2026-10-14');
    expect(r).toMatchObject({ days_tracked: 0, total_gross: 0, latest: null, first_date: null, languages: ['Telugu'] });
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

  it('running series first, then advance, then first fetches, then final breakdowns newest first', () => {
    const movies = [
      movie('run', { onAdvance: true }),
      movie('soon', { releaseDate: '2026-10-15', lastTrackedDate: null, onList: false, onAdvance: true }),
      movie('old', { releaseDate: '2026-06-01', lastTrackedDate: '2026-07-01' }),
      movie('quiet') // running, no advance sales listed -> no advance page
    ];
    const stored = new Map([
      ['run', { availableDates: ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'], finalDates: new Set(['2026-10-11']), lastDate: '2026-10-14' }],
      ['old', { availableDates: ['2026-06-01'], finalDates: new Set<string>(), lastDate: '2026-07-01' }]
    ]);
    const tasks = planTasks(movies, new Map(), stored, now, today);
    expect(tasks.map((t) => `${t.reason}:${t.movieId}:${t.date ?? ''}`)).toEqual([
      'series_active:run:',
      'series_active:quiet:',
      'advance:soon:',
      'advance:run:',
      'series_first:old:',
      'date_final:run:2026-10-13',
      'date_final:run:2026-10-12'
    ]);
  });

  it('respects freshness, recent failures and stopped movies', () => {
    const fetched = new Map([
      ['run|series', { at: now - 10 * 60_000, ok: true }],
      ['run|advance', { at: now - 60 * 60_000, ok: false }]
    ]);
    const tasks = planTasks([movie('run', { onAdvance: true }), movie('stop', { stopped: true })], fetched, new Map(), now, today);
    expect(tasks).toEqual([]);
  });
});

describe('advance list', () => {
  it('reads every advance listing once', async () => {
    const { parseAdvanceList } = await import('../parse');
    const { flightHtml } = await import('./fixtures');
    const cfg = (movieId: string, releaseDate: string) =>
      `["$","$L1e","${movieId}",{"config":${JSON.stringify({ movieId, title: movieId.toUpperCase(), releaseDate, language: 'Tamil', region: 'india', badge: '$undefined', poster: 'p' })},"summary":{"totalGross":1},"rank":1}]`;
    const html = flightHtml(`9:[${cfg('jailer-2', '2026-10-15')},${cfg('desu7', '2026-10-16')},${cfg('jailer-2', '2026-10-15')}]`);
    expect(parseAdvanceList(html)).toEqual([
      { id: 'jailer-2', title: 'JAILER-2', language: 'Tamil', releaseDate: '2026-10-15', poster: 'p', badge: null },
      { id: 'desu7', title: 'DESU7', language: 'Tamil', releaseDate: '2026-10-16', poster: 'p', badge: null }
    ]);
  });
});
