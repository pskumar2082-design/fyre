import { describe, it, expect } from 'vitest';
import {
  parseIndianNumber,
  parseGrossCr,
  parseCount,
  parsePct,
  parseMovieMeta,
  parseAdvanceStats,
  parseTrackedStats,
  parseDailySeries,
  parseBreakdownTable,
  htmlToLines,
  parseListingSlugs
} from '@/lib/moviemintParser';

// ---------------------------------------------------------------------------
// Fixtures below reconstruct the field layout and values actually observed
// on moviemintbo.com during the investigation -- reproduced structurally
// (label/value order, table columns, or the embedded Next.js Flight
// payload's own JSON field names), not copied verbatim as a full page
// capture.
//
// parseMovieMeta/parseAdvanceStats/parseTrackedStats/parseBreakdownTable
// all prefer the Flight payload when present (confirmed live, 2026-09-21:
// movie detail pages embed their real data there, the same way listing
// pages do -- see parseListingSlugs' own fixtures below) and only fall
// back to the original render/text-based parsing otherwise -- linesToHtml
// exercises that fallback path honestly, by going through the real
// htmlToLines() rather than calling a lines-shaped function directly.
// ---------------------------------------------------------------------------

const linesToHtml = (lines: string[]) => lines.map((l) => `<div>${l}</div>`).join('');

describe('numeric parsing', () => {
  it('parses crore currency', () => {
    expect(parseGrossCr('₹4.78Cr')).toBeCloseTo(4.78, 5);
  });

  it('parses lakh currency into crore', () => {
    expect(parseGrossCr('₹93.52L')).toBeCloseTo(0.9352, 5);
  });

  it('parses plain rupee currency (no suffix) into crore', () => {
    expect(parseGrossCr('₹600')).toBeCloseTo(0.00006, 8);
  });

  it('parses comma-separated ticket counts', () => {
    expect(parseCount('1,247')).toBe(1247);
  });

  it('parses K/L count suffixes', () => {
    expect(parseCount('7.30K')).toBe(7300);
    expect(parseCount('1.85L')).toBe(185000);
  });

  it('parses plain integer counts', () => {
    expect(parseCount('678')).toBe(678);
  });

  it('parses percentages', () => {
    expect(parsePct('11.42%')).toBe(11.42);
  });

  it('returns null for missing/unparseable values', () => {
    expect(parseIndianNumber(null)).toBeNull();
    expect(parseIndianNumber(undefined)).toBeNull();
    expect(parseIndianNumber('')).toBeNull();
    expect(parsePct('—')).toBeNull();
  });
});

describe('parseMovieMeta', () => {
  it('prefers the embedded Flight `config`, converting releaseDate/genres to the legacy text shape', () => {
    const html = `<script>self.__next_f.push([1, "11:[\\"$\\",\\"$L12\\",null,{\\"data\\":{\\"config\\":{\\"movieId\\":\\"example-movie\\",\\"title\\":\\"Example Movie\\",\\"tmdbId\\":123,\\"poster\\":\\"https://image.tmdb.org/t/p/w342/example.jpg\\",\\"releaseDate\\":\\"2026-08-07\\",\\"language\\":\\"Hindi\\",\\"genres\\":[\\"Family\\",\\"Drama\\"],\\"region\\":\\"india\\"}}}]"])</script>`;
    const meta = parseMovieMeta(html);
    expect(meta.title).toBe('Example Movie');
    expect(meta.releaseDateText).toBe('Release: August 7, 2026');
    expect(meta.language).toBe('Hindi');
    expect(meta.genre).toBe('Family, Drama');
  });

  it('falls back to line-based extraction when no Flight config is present', () => {
    const html = linesToHtml([
      'Back to Advance',
      'Tracked',
      'Hanuman Ansh',
      'Release: August 7, 2026',
      'Hindi',
      'Family',
      'Advance data: Day 45 — September 20, 2026'
    ]);
    const meta = parseMovieMeta(html);
    expect(meta.title).toBe('Hanuman Ansh');
    expect(meta.releaseDateText).toBe('Release: August 7, 2026');
    expect(meta.language).toBe('Hindi');
    expect(meta.genre).toBe('Family');
  });

  it('handles a fallback movie page with no genre line', () => {
    const html = linesToHtml(['Resident Evil', 'Release: September 18, 2026', 'English', 'ADVANCE GROSS']);
    const meta = parseMovieMeta(html);
    expect(meta.title).toBe('Resident Evil');
    expect(meta.language).toBe('English');
  });
});

describe('parseAdvanceStats', () => {
  it('prefers the embedded Flight `summary`, converting gross to Crores', () => {
    const html = `<script>self.__next_f.push([1, "11:[\\"$\\",\\"$L12\\",null,{\\"data\\":{\\"config\\":{\\"title\\":\\"Example Movie\\"},\\"summary\\":{\\"totalGross\\":47800000,\\"totalShows\\":7300,\\"totalTicketsSold\\":185000,\\"totalSeats\\":1620000,\\"totalLocations\\":678,\\"avgOccupancy\\":11.42},\\"selectedDate\\":\\"20260920\\",\\"metadata\\":{\\"source\\":\\"BookMyShow\\",\\"lastUpdated\\":\\"2026-09-20 09:05 IST\\"}}}]"])</script>`;
    const stats = parseAdvanceStats(html);
    expect(stats.gross).toBeCloseTo(4.78, 5);
    expect(stats.tickets).toBe(185000);
    expect(stats.shows).toBe(7300);
    expect(stats.cities).toBe(678);
    expect(stats.occupancyPct).toBe(11.42);
    expect(stats.dayLabelText).toBe('Advance data: September 20, 2026');
    expect(stats.freshnessText).toBe('Updated 2026-09-20 09:05 IST');
  });

  const lines = [
    'Hanuman Ansh',
    'Release: August 7, 2026',
    'Hindi',
    'Family',
    'Advance data: Day 45 — September 20, 2026',
    'ADVANCE GROSS',
    '₹4.78Cr',
    'TICKETS SOLD',
    '1.85L',
    'SHOWS',
    '7.30K',
    'CITIES',
    '678',
    '%',
    'OCCUPANCY',
    '11.42%',
    'Performance Breakdown',
    'INDIA',
    'Updated 1h 5m ago'
  ];

  it('falls back to line-based extraction when no Flight summary is present', () => {
    const stats = parseAdvanceStats(linesToHtml(lines));
    expect(stats.gross).toBeCloseTo(4.78, 5);
    expect(stats.tickets).toBe(185000);
    expect(stats.shows).toBe(7300);
    expect(stats.cities).toBe(678);
    expect(stats.occupancyPct).toBe(11.42);
    expect(stats.dayLabelText).toBe('Advance data: Day 45 — September 20, 2026');
    expect(stats.freshnessText).toBe('Updated 1h 5m ago');
  });

  it('skips the stray "%" icon line before OCCUPANCY in the fallback path', () => {
    const stats = parseAdvanceStats(linesToHtml(lines));
    expect(stats.occupancyPct).not.toBeNull();
  });

  it('returns nulls (not zeros) for fields that never appear, in the fallback path', () => {
    const missingCities = lines.filter((l) => l !== 'CITIES' && l !== '678');
    const stats = parseAdvanceStats(linesToHtml(missingCities));
    expect(stats.cities).toBeNull();
    expect(stats.gross).not.toBeNull();
  });
});

describe('parseTrackedStats', () => {
  it('prefers the embedded Flight `summary`/`dailySeries`, summing lifetime totals', () => {
    const html = `<script>self.__next_f.push([1, "11:[\\"$\\",\\"$L12\\",null,{\\"data\\":{\\"config\\":{\\"title\\":\\"Example Movie\\"},\\"summary\\":{\\"totalGross\\":0,\\"totalShows\\":0,\\"totalTicketsSold\\":0,\\"totalSeats\\":0,\\"totalLocations\\":707},\\"dailySeries\\":[{\\"date\\":\\"20260805\\",\\"gross\\":20000000,\\"ticketsSold\\":100000,\\"shows\\":5000,\\"totalSeats\\":300000,\\"avgOccupancy\\":33.3},{\\"date\\":\\"20260806\\",\\"gross\\":15000000,\\"ticketsSold\\":80000,\\"shows\\":4000,\\"totalSeats\\":250000,\\"avgOccupancy\\":32.0}],\\"selectedDate\\":\\"20260918\\",\\"metadata\\":{\\"source\\":\\"BookMyShow\\",\\"lastUpdated\\":\\"2026-09-18 20:43 IST\\"},\\"completedMode\\":true,\\"completedAsOf\\":\\"20:43 IST\\"}}]"])</script>`;
    const stats = parseTrackedStats(html);
    expect(stats.todayGross).toBe(0);
    expect(stats.lifetimeGross).toBeCloseTo(3.5, 5);
    expect(stats.lifetimeTickets).toBe(180000);
    expect(stats.lifetimeShows).toBe(9000);
    expect(stats.cities).toBe(707);
    expect(stats.lifetimeOccupancyPct).toBeCloseTo(32.7, 5);
    expect(stats.dayLabelText).toBe('Breakdown for: September 18, 2026');
    expect(stats.freshnessText).toBe('Updated 2026-09-18 20:43 IST');
    expect(stats.completedShowsText).toBe('Completed shows till 20:43 IST');
  });

  it('does not double-count a day that has already rolled into dailySeries', () => {
    const html = `<script>self.__next_f.push([1, "11:[\\"$\\",\\"$L12\\",null,{\\"data\\":{\\"summary\\":{\\"totalGross\\":5000000,\\"totalShows\\":1500,\\"totalTicketsSold\\":30000,\\"totalSeats\\":90000,\\"totalLocations\\":707},\\"dailySeries\\":[{\\"date\\":\\"20260805\\",\\"gross\\":20000000,\\"ticketsSold\\":100000,\\"shows\\":5000,\\"totalSeats\\":300000,\\"avgOccupancy\\":33.3},{\\"date\\":\\"20260806\\",\\"gross\\":15000000,\\"ticketsSold\\":80000,\\"shows\\":4000,\\"totalSeats\\":250000,\\"avgOccupancy\\":32.0},{\\"date\\":\\"20260918\\",\\"gross\\":5000000,\\"ticketsSold\\":30000,\\"shows\\":1500,\\"totalSeats\\":90000,\\"avgOccupancy\\":33.3}],\\"selectedDate\\":\\"20260918\\"}}]"])</script>`;
    const stats = parseTrackedStats(html);
    // Series alone: (20000000 + 15000000 + 5000000) / 1e7 = 4.0 -- NOT
    // 4.5, which is what double-adding `summary` on top would produce.
    expect(stats.lifetimeGross).toBeCloseTo(4.0, 5);
    expect(stats.lifetimeTickets).toBe(210000);
  });

  it('returns [] when there is no Flight dailySeries at all', () => {
    const html = `<script>self.__next_f.push([1, "11:[\\"$\\",\\"$L12\\",null,{\\"data\\":{\\"summary\\":{\\"totalGross\\":0}}}]"])</script>`;
    expect(parseDailySeries(html)).toEqual([]);
  });
});

describe('parseDailySeries', () => {
  const html = `<script>self.__next_f.push([1, "11:[\\"$\\",\\"$L12\\",null,{\\"data\\":{\\"summary\\":{\\"totalGross\\":0}},\\"dailySeries\\":[{\\"date\\":\\"20260805\\",\\"gross\\":20000000,\\"ticketsSold\\":100000,\\"shows\\":5000,\\"totalSeats\\":300000,\\"avgOccupancy\\":33.3,\\"lastUpdated\\":\\"2026-08-05 23:40 IST\\"},{\\"date\\":\\"20260806\\",\\"gross\\":15000000,\\"ticketsSold\\":80000,\\"shows\\":4000,\\"totalSeats\\":250000,\\"avgOccupancy\\":32.0,\\"lastUpdated\\":\\"2026-08-06 23:41 IST\\"}]}]"])</script>`;

  it('returns one entry per completed day, converting the compact date and Cr-scaling gross', () => {
    const entries = parseDailySeries(html);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      dateIso: '2026-08-05',
      gross: 2,
      tickets: 100000,
      shows: 5000,
      occupancyPct: 33.3,
      capacity: 300000,
      lastUpdatedText: '2026-08-05 23:40 IST'
    });
    expect(entries[1].dateIso).toBe('2026-08-06');
  });

  it('returns [] when the page has no dailySeries (e.g. an advance-only page)', () => {
    const noSeriesHtml = `<script>self.__next_f.push([1, "11:[\\"$\\",\\"$L12\\",null,{\\"data\\":{\\"summary\\":{\\"totalGross\\":0}}}]"])</script>`;
    expect(parseDailySeries(noSeriesHtml)).toEqual([]);
  });
});

describe('parseTrackedStatsFromLines fallback', () => {
  it('falls back to line-based extraction when no Flight summary is present', () => {
    const lines = [
      'Hanuman Ansh',
      'Release: August 7, 2026',
      'Hindi',
      'Family',
      "TODAY'S GROSS",
      '₹9.54Cr',
      'LIFETIME GROSS',
      '₹317.67Cr',
      'LIFETIME TICKETS',
      '1.34Cr',
      'LIFETIME SHOWS',
      '1.85L',
      'CITIES',
      '707',
      '%',
      'LIFETIME OCCUPANCY',
      '36.7%',
      'Performance Breakdown',
      'INDIA',
      'Updated 4m ago',
      'Breakdown for: Day 44 — September 18, 2026',
      'Completed shows till 20:43 IST'
    ];
    const stats = parseTrackedStats(linesToHtml(lines));
    expect(stats.todayGross).toBeCloseTo(9.54, 5);
    expect(stats.lifetimeGross).toBeCloseTo(317.67, 5);
    expect(stats.lifetimeTickets).toBe(13400000);
    expect(stats.lifetimeShows).toBe(185000);
    expect(stats.cities).toBe(707);
    expect(stats.lifetimeOccupancyPct).toBe(36.7);
    expect(stats.dayLabelText).toBe('Breakdown for: Day 44 — September 18, 2026');
    expect(stats.freshnessText).toBe('Updated 4m ago');
    expect(stats.completedShowsText).toBe('Completed shows till 20:43 IST');
  });
});

describe('parseBreakdownTable', () => {
  it('prefers the embedded Flight india{States,Languages,Formats}, covering all three at once', () => {
    const html = `<script>self.__next_f.push([1, "11:[\\"$\\",\\"$L12\\",null,{\\"data\\":{\\"indiaStates\\":[{\\"name\\":\\"Telangana\\",\\"gross\\":15540249,\\"ticketsSold\\":74766,\\"totalSeats\\":170916,\\"occupancy\\":43.74,\\"shows\\":269,\\"venues\\":57,\\"fastFilling\\":79,\\"houseFull\\":13}],\\"indiaLanguages\\":[{\\"language\\":\\"Telugu\\",\\"gross\\":16974633,\\"ticketsSold\\":82439,\\"shows\\":314,\\"cities\\":41,\\"occupancy\\":43.19}],\\"indiaFormats\\":[{\\"format\\":\\"Standard\\",\\"gross\\":17137183,\\"ticketsSold\\":83558,\\"shows\\":331,\\"cities\\":42,\\"occupancy\\":41.9}]}}]"])</script>`;
    const result = parseBreakdownTable(html);
    expect(result.rows).toHaveLength(3);
    expect(result.total).toBeNull();

    const state = result.rows.find((r) => r.breakdownType === 'state');
    expect(state?.label).toBe('Telangana');
    expect(state?.gross).toBeCloseTo(1.5540249, 5);
    expect(state?.shows).toBe(269);
    expect(state?.ticketsSold).toBe(74766);
    expect(state?.occPct).toBe(43.74);
    expect(state?.rawFf).toBe(79);
    expect(state?.soldOut).toBe(13);

    const language = result.rows.find((r) => r.breakdownType === 'language');
    expect(language?.label).toBe('Telugu');
    expect(language?.gross).toBeCloseTo(1.6974633, 5);
    expect(language?.rawFf).toBeNull();
    expect(language?.soldOut).toBeNull();

    const format = result.rows.find((r) => r.breakdownType === 'format');
    expect(format?.label).toBe('Standard');
    expect(format?.gross).toBeCloseTo(1.7137183, 5);
  });

  const stateTableHtml = `
    <table>
      <thead>
        <tr><th>STATE</th><th>GROSS</th><th>SHOWS</th><th>TICKETS SOLD</th><th>FF</th><th>SOLD OUT</th><th>OCC %</th></tr>
      </thead>
      <tbody>
        <tr><td>Uttar Pradesh</td><td>₹93.52L</td><td>1.11K</td><td>38.50K</td><td>76</td><td>17</td><td>14.89%</td></tr>
        <tr><td>Maharashtra</td><td>₹70.59L</td><td>1.12K</td><td>24.90K</td><td>24</td><td>1</td><td>9.17%</td></tr>
        <tr><td>TOTAL</td><td>₹4.78Cr</td><td>7.30K</td><td>1.85L</td><td>327</td><td>27</td><td>11.42%</td></tr>
      </tbody>
    </table>
  `;

  it('falls back to DOM parsing and tags rows with breakdownType from the header (STATE -> state)', () => {
    const result = parseBreakdownTable(stateTableHtml);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].breakdownType).toBe('state');
    expect(result.rows[0].label).toBe('Uttar Pradesh');
    expect(result.rows[0].gross).toBeCloseTo(0.9352, 5);
    expect(result.rows[0].shows).toBe(1110);
    expect(result.rows[0].ticketsSold).toBe(38500);
    expect(result.rows[0].rawFf).toBe(76);
    expect(result.rows[0].soldOut).toBe(17);
    expect(result.rows[0].occPct).toBe(14.89);
  });

  it('separates the TOTAL row instead of treating it as a normal entry, in the DOM fallback', () => {
    const result = parseBreakdownTable(stateTableHtml);
    expect(result.rows.find((r) => r.label.toUpperCase() === 'TOTAL')).toBeUndefined();
    expect(result.total).not.toBeNull();
    expect(result.total?.gross).toBeCloseTo(4.78, 5);
  });

  it('tags LANGUAGE and FORMAT headers correctly, in the DOM fallback', () => {
    const langHtml = `<table><tr><th>LANGUAGE</th><th>GROSS</th></tr><tr><td>Hindi</td><td>₹1.00Cr</td></tr></table>`;
    const formatHtml = `<table><tr><th>FORMAT</th><th>GROSS</th></tr><tr><td>IMAX</td><td>₹1.00Cr</td></tr></table>`;
    expect(parseBreakdownTable(langHtml).rows[0].breakdownType).toBe('language');
    expect(parseBreakdownTable(formatHtml).rows[0].breakdownType).toBe('format');
  });

  it('returns an empty result for a page with no Flight data and no breakdown table', () => {
    const result = parseBreakdownTable('<div>no table here</div>');
    expect(result.rows).toEqual([]);
    expect(result.total).toBeNull();
  });

  it('never invents a value for a missing column, in the DOM fallback', () => {
    const noFf = `<table><tr><th>STATE</th><th>GROSS</th></tr><tr><td>Kerala</td><td>₹1.00Cr</td></tr></table>`;
    const result = parseBreakdownTable(noFf);
    expect(result.rows[0].rawFf).toBeNull();
    expect(result.rows[0].shows).toBeNull();
  });
});

describe('htmlToLines', () => {
  it('starts a new line at block-element boundaries, not inline ones', () => {
    const html = '<div><div>GROSS</div><div>₹1.00Cr</div></div><span>inline</span><span> text</span>';
    const lines = htmlToLines(html);
    expect(lines).toContain('GROSS');
    expect(lines).toContain('₹1.00Cr');
    expect(lines).toContain('inline text');
  });
});

describe('parseListingSlugs', () => {
  it('extracts slug and title from movie links, de-duplicated', () => {
    const html = `
      <a href="/movie/hanuman-ansh?kind=advance"><h3>Hanuman Ansh</h3></a>
      <a href="/movie/hanuman-ansh?kind=advance"><h3>Hanuman Ansh</h3></a>
      <a href="/movie/mandaadi?kind=advance"><h3>Mandaadi</h3></a>
    `;
    const entries = parseListingSlugs(html);
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.slug)).toEqual(['hanuman-ansh', 'mandaadi']);
  });

  it('prefers the embedded Next.js Flight payload when present, converting gross to Crores', () => {
    const html = `<script>self.__next_f.push([1, "11:[\\"$\\",\\"$L21\\",null,{\\"movies\\":[{\\"boxOfficeId\\": \\"example-one\\", \\"title\\": \\"Example One\\", \\"poster\\": \\"https://image.tmdb.org/t/p/w780/example1.jpg\\", \\"releaseDate\\": \\"2026-09-10\\", \\"language\\": \\"Telugu\\", \\"genres\\": [], \\"href\\": \\"/movie/example-one?date=20260920\\", \\"gross\\": 50000000, \\"ticketsSold\\": 200000, \\"totalSeats\\": 900000, \\"shows\\": 4000, \\"avgOccupancy\\": 22.2, \\"topState\\": \\"Telangana\\", \\"sourceDate\\": \\"20260920\\"},{\\"boxOfficeId\\": \\"example-two\\", \\"title\\": \\"Example Two\\", \\"poster\\": \\"https://image.tmdb.org/t/p/w780/example2.jpg\\", \\"releaseDate\\": \\"2026-09-05\\", \\"language\\": \\"Hindi\\", \\"genres\\": [], \\"href\\": \\"/movie/example-two?date=20260921\\", \\"gross\\": 25000000, \\"ticketsSold\\": 100000, \\"totalSeats\\": 450000, \\"shows\\": 2000, \\"avgOccupancy\\": 18.5, \\"topState\\": \\"Maharashtra\\", \\"sourceDate\\": \\"20260921\\"}]}]"])</script>`;
    const entries = parseListingSlugs(html);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ rank: 1, slug: 'example-one', title: 'Example One', gross: 5 });
    expect(entries[1]).toEqual({ rank: 2, slug: 'example-two', title: 'Example Two', gross: 2.5 });
  });

  it('falls back to DOM scraping when no Flight "movies" array is present (e.g. /advance)', () => {
    const html = `
      <script>self.__next_f.push([1,"11:[\\"$\\",\\"$L1e\\",null,{\\"recentTracked\\":[]}]"])</script>
      <a href="/movie/hanuman-ansh"><h3>Hanuman Ansh</h3></a>
    `;
    const entries = parseListingSlugs(html);
    expect(entries).toHaveLength(1);
    expect(entries[0].slug).toBe('hanuman-ansh');
    expect(entries[0].gross).toBeNull();
  });
});
