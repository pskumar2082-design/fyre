import { describe, it, expect } from 'vitest';
import { parseLiveMovies, parseMovieDetails } from '../scraper';

// Fixtures below reproduce the real markup shape confirmed live against
// tracktollywood.com on 2026-09-21 (see scraper.ts's comments) --
// trimmed to the elements each parser actually reads, not a full page
// capture.

describe('parseLiveMovies', () => {
  const html = `
    <a href="https://tracktollywood.com/box-office-collection/daayra/" class="tt-hub-card">
      <div class="tt-hub-card-poster">
        <span class="tt-hub-card-badge tt-hub-badge--live">Live</span>
        <span class="tt-hub-card-daybadge">Day 4</span>
        <span class="tt-hub-card-release">Released <b>18 Sep 2026</b></span>
        <img class="tt-hub-card-poster-fg" src="data:image/svg+xml,x" data-lazy-src="https://tracktollywood.com/wp-content/poster-daayra.jpg.webp" alt="Daayra poster" />
      </div>
      <div class="tt-hub-card-body">
        <h3 class="tt-hub-card-title">Daayra</h3>
        <span class="tt-hub-card-genre">Crime, Drama, Thriller</span>
        <div class="tt-hub-card-hero">
          <span class="tt-hub-card-gross">₹5.41Cr</span>
          <span class="tt-hub-card-grosslab">India Gross</span>
        </div>
        <div class="tt-hub-card-sub">
          <span class="tt-hub-card-today">today <b>₹42.40L</b></span>
        </div>
        <div class="tt-hub-card-footer"><span>Upd 2026-09-21 18:03 IST</span></div>
      </div>
    </a>
    <a href="https://tracktollywood.com/box-office-collection/418/" class="tt-hub-card">
      <div class="tt-hub-card-poster">
        <span class="tt-hub-card-badge tt-hub-badge--upcoming">Upcoming</span>
        <span class="tt-hub-card-release">Releasing <b>25 Sep 2026</b></span>
      </div>
      <div class="tt-hub-card-body">
        <h3 class="tt-hub-card-title">418</h3>
        <span class="tt-hub-card-genre">Horror, Thriller</span>
      </div>
    </a>
  `;

  it('parses a live card with full stats and a real (non-data:) poster', () => {
    const movies = parseLiveMovies(html);
    expect(movies).toHaveLength(2);
    const daayra = movies[0];
    expect(daayra.slug).toBe('daayra');
    expect(daayra.title).toBe('Daayra');
    expect(daayra.state).toBe('live');
    expect(daayra.dayLabel).toBe('Day 4');
    expect(daayra.genre).toBe('Crime, Drama, Thriller');
    expect(daayra.gross).toBe('₹5.41Cr');
    expect(daayra.grossCr).toBeCloseTo(5.41);
    expect(daayra.grossLabel).toBe('India Gross');
    expect(daayra.poster).toBe('https://tracktollywood.com/wp-content/poster-daayra.jpg.webp');
    expect(daayra.updatedText).toContain('2026-09-21');
  });

  it('parses an upcoming card with no gross figures yet, and never returns a data: URI as poster', () => {
    const movies = parseLiveMovies(html);
    const upcoming = movies[1];
    expect(upcoming.slug).toBe('418');
    expect(upcoming.state).toBe('upcoming');
    expect(upcoming.gross).toBeNull();
    expect(upcoming.grossCr).toBeNull();
    expect(upcoming.poster).toBeNull(); // only a data:image/svg+xml placeholder was present
  });

  it('skips a card with no title rather than emitting a junk entry', () => {
    const junkHtml = `<a href="https://tracktollywood.com/box-office-collection/x/" class="tt-hub-card"><div class="tt-hub-card-body"></div></a>`;
    expect(parseLiveMovies(junkHtml)).toHaveLength(0);
  });
});

describe('parseMovieDetails', () => {
  const html = `
    <h1 class="tt-mv-title">Daayra</h1>
    <span class="tt-mv-badge tt-mv-badge--live">Live Tracking &middot; Day 4</span>
    <img class="tt-mv-poster-fg" src="https://tracktollywood.com/wp-content/poster-daayra.jpg.webp" alt="Daayra poster" />
    <div class="tt-mv-body">
      <div class="tt-mv-headline">
        <span class="tt-mv-big">₹5.41Cr</span>
        <span class="tt-mv-headline-label">India Gross &middot; Day 4 running</span>
      </div>
      <div class="tt-mv-stats">
        <div class="tt-mv-stat"><span class="tt-mv-stat-value">₹42.40L</span><span class="tt-mv-stat-label">Today's Gross</span></div>
        <div class="tt-mv-stat"><span class="tt-mv-stat-value">₹1.91Cr</span><span class="tt-mv-stat-label">Best Day &middot; Day 3</span></div>
      </div>
    </div>
    <div class="tt-ac-table-wrap" data-snapshot="Day-wise Collection">
      <table class="tt-ac-table">
        <thead><tr><th>Day</th><th>Date</th><th>Weekday</th><th class="tt-ac-num">Gross (₹)</th><th class="tt-ac-num">Tickets</th></tr></thead>
        <tbody>
          <tr class="tt-ac-totals">
            <th scope="row" colspan="3"><strong>TOTAL</strong></th>
            <td class="tt-ac-num"><strong>₹4.99 Cr</strong></td>
            <td class="tt-ac-num"><strong>155,635</strong></td>
          </tr>
          <tr>
            <th scope="row">Day 1</th><td>17 Sep</td><td>Thu</td><td class="tt-ac-num">₹1.20 Cr</td><td class="tt-ac-num">38,000</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  it('reads the title, state, poster, headline and stats', () => {
    const d = parseMovieDetails(html, 'daayra');
    expect(d.title).toBe('Daayra');
    expect(d.state).toBe('live');
    expect(d.poster).toBe('https://tracktollywood.com/wp-content/poster-daayra.jpg.webp');
    expect(d.headlineGross).toBe('₹5.41Cr');
    expect(d.stats).toEqual([
      { label: "Today's Gross", value: '₹42.40L', note: null },
      { label: 'Best Day', value: '₹1.91Cr', note: 'Day 3' }
    ]);
  });

  it('parses every data-snapshot table generically, aligning a colspan TOTAL row by header position', () => {
    const d = parseMovieDetails(html, 'daayra');
    expect(d.tables).toHaveLength(1);
    const table = d.tables[0];
    expect(table.label).toBe('Day-wise Collection');
    expect(table.headers).toEqual(['Day', 'Date', 'Weekday', 'Gross (₹)', 'Tickets']);

    // The TOTAL row's first cell has colspan=3 (covering Day/Date/Weekday)
    // -- naive index-based mapping would shift Gross/Tickets one column
    // left. The colspan-aware walk in scraper.ts must keep them aligned
    // to their real headers.
    const totalRow = table.rows[0];
    expect(totalRow.__isTotal).toBe(true);
    expect(totalRow['Day']).toBe('TOTAL');
    expect(totalRow['Gross (₹)']).toBe('₹4.99 Cr');
    expect(totalRow['Tickets']).toBe('155,635');

    const day1 = table.rows[1];
    expect(day1.__isTotal).toBeUndefined();
    expect(day1['Date']).toBe('17 Sep');
    expect(day1['Weekday']).toBe('Thu');
    expect(day1['Gross (₹)']).toBe('₹1.20 Cr');
  });

  it('falls back to the slug as title when the page has no title element', () => {
    const d = parseMovieDetails('<div>nothing here</div>', 'some-slug');
    expect(d.title).toBe('some-slug');
    expect(d.tables).toHaveLength(0);
    expect(d.stats).toHaveLength(0);
  });
});
