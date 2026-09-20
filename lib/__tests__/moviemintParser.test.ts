import { describe, it, expect } from 'vitest';
import {
  parseIndianNumber,
  parseGrossCr,
  parseCount,
  parsePct,
  parseMovieMeta,
  parseAdvanceStats,
  parseTrackedStats,
  parseBreakdownTable,
  htmlToLines,
  parseListingSlugs
} from '@/lib/moviemintParser';

// ---------------------------------------------------------------------------
// Fixtures below reconstruct the field layout and values actually observed
// on moviemintbo.com during the investigation (a "Hanuman Ansh" movie page,
// Sep 2026) -- reproduced structurally (label/value order, table columns),
// not copied verbatim as a full page capture.
// ---------------------------------------------------------------------------

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
  const lines = [
    'Back to Advance',
    'Tracked',
    'Hanuman Ansh',
    'Release: August 7, 2026',
    'Hindi',
    'Family',
    'Advance data: Day 45 — September 20, 2026'
  ];

  it('extracts title, release date text, language and genre', () => {
    const meta = parseMovieMeta(lines);
    expect(meta.title).toBe('Hanuman Ansh');
    expect(meta.releaseDateText).toBe('Release: August 7, 2026');
    expect(meta.language).toBe('Hindi');
    expect(meta.genre).toBe('Family');
  });

  it('handles a movie with no genre line', () => {
    const noGenre = ['Resident Evil', 'Release: September 18, 2026', 'English', 'ADVANCE GROSS'];
    const meta = parseMovieMeta(noGenre);
    expect(meta.title).toBe('Resident Evil');
    expect(meta.language).toBe('English');
  });
});

describe('parseAdvanceStats', () => {
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

  it('parses every confirmed advance field', () => {
    const stats = parseAdvanceStats(lines);
    expect(stats.gross).toBeCloseTo(4.78, 5);
    expect(stats.tickets).toBe(185000);
    expect(stats.shows).toBe(7300);
    expect(stats.cities).toBe(678);
    expect(stats.occupancyPct).toBe(11.42);
    expect(stats.dayLabelText).toBe('Advance data: Day 45 — September 20, 2026');
    expect(stats.freshnessText).toBe('Updated 1h 5m ago');
  });

  it('skips the stray "%" icon line before OCCUPANCY', () => {
    const stats = parseAdvanceStats(lines);
    expect(stats.occupancyPct).not.toBeNull();
  });

  it('returns nulls (not zeros) for fields that never appear', () => {
    const missingCities = lines.filter((l) => l !== 'CITIES' && l !== '678');
    const stats = parseAdvanceStats(missingCities);
    expect(stats.cities).toBeNull();
    expect(stats.gross).not.toBeNull();
  });
});

describe('parseTrackedStats', () => {
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

  it('parses every confirmed tracked field', () => {
    const stats = parseTrackedStats(lines);
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

  it('tags rows with breakdownType from the header (STATE -> state)', () => {
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

  it('separates the TOTAL row instead of treating it as a normal entry', () => {
    const result = parseBreakdownTable(stateTableHtml);
    expect(result.rows.find((r) => r.label.toUpperCase() === 'TOTAL')).toBeUndefined();
    expect(result.total).not.toBeNull();
    expect(result.total?.gross).toBeCloseTo(4.78, 5);
  });

  it('tags LANGUAGE and FORMAT headers correctly', () => {
    const langHtml = `<table><tr><th>LANGUAGE</th><th>GROSS</th></tr><tr><td>Hindi</td><td>₹1.00Cr</td></tr></table>`;
    const formatHtml = `<table><tr><th>FORMAT</th><th>GROSS</th></tr><tr><td>IMAX</td><td>₹1.00Cr</td></tr></table>`;
    expect(parseBreakdownTable(langHtml).rows[0].breakdownType).toBe('language');
    expect(parseBreakdownTable(formatHtml).rows[0].breakdownType).toBe('format');
  });

  it('returns an empty result for a page with no breakdown table', () => {
    const result = parseBreakdownTable('<div>no table here</div>');
    expect(result.rows).toEqual([]);
    expect(result.total).toBeNull();
  });

  it('never invents a value for a missing column', () => {
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
});
