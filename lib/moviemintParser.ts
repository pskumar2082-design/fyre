import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Pure parsing only -- no fetch, no DB. Takes the rendered HTML of a
// MovieMint page (see moviemintClient.ts for how that's obtained) and
// returns typed data.
//
// MovieMint's confirmed page shapes (from live inspection, Sep 2026):
//   /movie/<slug>?kind=advance   -- title/meta + advance stat block +
//                                    one breakdown table (whichever of
//                                    State/Language/Format Wise is the
//                                    default active tab in the rendered
//                                    page -- these are client-side tabs,
//                                    so only the active one is ever
//                                    present in a single render; see the
//                                    module note on breakdownType below)
//   /movie/<slug>?kind=tracked   -- title/meta + tracked stat block +
//                                    the same kind of breakdown table
//   /advance, /tracked           -- top-10 listing, used for discovery
//   /multiplex-report            -- per-chain, per-movie gross/shows for
//                                    a NAMED, LIMITED set of multiplexes
//                                    (MovieMint's own words: "select
//                                    multiplexes") -- never treat this as
//                                    exhaustive theatre coverage anywhere
//                                    downstream.
//
// This is intentionally best-effort, matching the rest of this codebase's
// scraper style (sacnilkParser.ts, sacnilkMovieProfileParser.ts): if
// MovieMint's markup doesn't match what's expected here, functions return
// null / empty arrays rather than throwing, so one page's odd shape can't
// take down a whole sync run.
// ---------------------------------------------------------------------------

export type BreakdownType = 'state' | 'language' | 'format';

export type ParsedBreakdownRow = {
  breakdownType: BreakdownType;
  label: string;
  gross: number | null;
  shows: number | null;
  ticketsSold: number | null;
  soldOut: number | null;
  occPct: number | null;
  // MovieMint's "FF" column. Meaning unconfirmed -- see lib/moviemintMapper.ts
  // and supabase/migration_moviemint.sql (box_office_breakdown.raw_ff).
  // Never interpreted here, just carried through as a raw number.
  rawFf: number | null;
};

export type ParsedBreakdownTable = {
  rows: ParsedBreakdownRow[];
  total: ParsedBreakdownRow | null;
};

export type ParsedAdvanceStats = {
  gross: number | null;
  tickets: number | null;
  shows: number | null;
  cities: number | null;
  occupancyPct: number | null;
  dayLabelText: string | null; // e.g. "Advance data: Day 45 — September 20, 2026"
  freshnessText: string | null; // e.g. "Updated 1h 5m ago"
};

export type ParsedTrackedStats = {
  todayGross: number | null;
  lifetimeGross: number | null;
  lifetimeTickets: number | null;
  lifetimeShows: number | null;
  cities: number | null;
  lifetimeOccupancyPct: number | null;
  dayLabelText: string | null; // e.g. "Breakdown for: Day 44 — September 18, 2026"
  freshnessText: string | null; // e.g. "Updated 4m ago"
  completedShowsText: string | null; // e.g. "Completed shows till 20:43 IST"
};

export type ParsedMovieMeta = {
  title: string | null;
  releaseDateText: string | null; // e.g. "Release: August 7, 2026"
  language: string | null;
  genre: string | null;
};

export type ParsedMultiplexChain = {
  chain: string;
  totalGross: number | null;
  totalShows: number | null;
  movies: { rawTitle: string; gross: number | null; shows: number | null }[];
};

// ---------------------------------------------------------------------------
// HTML -> reading-order lines, approximating what a browser's innerText
// would produce (block elements start a new line, inline elements don't).
// Needed because the confirmed field layouts here are "label on one line,
// value on the next" rather than something with stable, known class names
// we could select on directly -- MovieMint's hydrated markup wasn't
// something this investigation could capture (only its rendered TEXT was
// reachable), so this parser works off text structure, not CSS selectors.
// ---------------------------------------------------------------------------
const BLOCK_TAGS = new Set([
  'div', 'tr', 'td', 'th', 'li', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'section', 'header', 'footer', 'table', 'thead', 'tbody', 'button',
  'main', 'article', 'ul', 'ol', 'dl', 'dt', 'dd', 'br'
]);

export function htmlToLines(html: string): string[] {
  const $ = cheerio.load(html);
  const lines: string[] = [];
  let current = '';

  const flush = () => {
    const t = current.replace(/\s+/g, ' ').trim();
    if (t) lines.push(t);
    current = '';
  };

  const walk = (node: any) => {
    if (!node) return;
    if (node.type === 'text') {
      current += node.data ?? '';
      return;
    }
    if (node.type !== 'tag') return;
    const tag = (node.name ?? '').toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'noscript') return;
    const isBlock = BLOCK_TAGS.has(tag);
    if (isBlock) flush();
    for (const child of node.children ?? []) walk(child);
    if (isBlock) flush();
  };

  const body = $('body').get(0);
  if (body) walk(body);
  flush();
  return lines.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Numeric parsing -- MovieMint uses the same Indian-numbering short forms
// as Sacnilk (Cr = crore, L = lakh, K = thousand) for BOTH currency and
// plain counts (e.g. tickets "1.85L", shows "7.30K", cities "678" plain).
// ---------------------------------------------------------------------------
export function parseIndianNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '').trim();
  const m = cleaned.match(/([\d.]+)\s*(Cr|L|K)?/i);
  if (!m || !m[1]) return null;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return null;
  const suffix = (m[2] ?? '').toUpperCase();
  if (suffix === 'CR') return n * 1e7;
  if (suffix === 'L') return n * 1e5;
  if (suffix === 'K') return n * 1e3;
  return n;
}

// Currency values are stored as ₹ Cr (crore) everywhere else in FYRE's
// schema (see lib/sacnilkParser.ts's parseCr), so this returns crore, not
// raw rupees, to stay consistent with the rest of the codebase.
export function parseGrossCr(text: string | null | undefined): number | null {
  const raw = parseIndianNumber(text);
  return raw == null ? null : raw / 1e7;
}

export function parseCount(text: string | null | undefined): number | null {
  const n = parseIndianNumber(text);
  return n == null ? null : Math.round(n);
}

export function parsePct(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/([\d.]+)\s*%/);
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------------------
// Movie title / meta (top of a /movie/<slug> page).
// ---------------------------------------------------------------------------
export function parseMovieMeta(lines: string[]): ParsedMovieMeta {
  const releaseIdx = lines.findIndex((l) => /^Release:/i.test(l));
  const title = releaseIdx > 0 ? lines[releaseIdx - 1] : null;
  const releaseDateText = releaseIdx >= 0 ? lines[releaseIdx] : null;
  // Language/genre are the one or two short lines right after "Release: ...",
  // before the next ALL-CAPS stat label (GROSS / ADVANCE GROSS / etc.) or
  // "Advance data:" / "Today's Gross" marker.
  let language: string | null = null;
  let genre: string | null = null;
  if (releaseIdx >= 0) {
    const after = lines.slice(releaseIdx + 1, releaseIdx + 4);
    const stopAt = after.findIndex((l) => /GROSS|Advance data:|Breakdown for:/i.test(l));
    const metaLines = stopAt >= 0 ? after.slice(0, stopAt) : after.slice(0, 2);
    language = metaLines[0] ?? null;
    genre = metaLines[1] ?? null;
  }
  return { title, releaseDateText, language, genre };
}

// ---------------------------------------------------------------------------
// Advance / Tracked stat blocks. Both follow "LABEL, then value on
// following line(s)" -- a stray lone "%" line sometimes precedes the
// "OCCUPANCY" label (an icon rendered as text) and is skipped.
// ---------------------------------------------------------------------------
function valueAfterLabel(lines: string[], labelPattern: RegExp): string | null {
  const idx = lines.findIndex((l) => labelPattern.test(l));
  if (idx < 0) return null;
  for (let i = idx + 1; i < Math.min(idx + 3, lines.length); i++) {
    const l = lines[i].trim();
    if (l === '%' || l === '') continue;
    return l;
  }
  return null;
}

export function parseAdvanceStats(lines: string[]): ParsedAdvanceStats {
  const dayLabelText = lines.find((l) => /^Advance data:/i.test(l)) ?? null;
  const freshnessText = lines.find((l) => /^Updated\b/i.test(l)) ?? null;
  return {
    gross: parseGrossCr(valueAfterLabel(lines, /^ADVANCE GROSS$/i)),
    tickets: parseCount(valueAfterLabel(lines, /^TICKETS SOLD$/i)),
    shows: parseCount(valueAfterLabel(lines, /^SHOWS$/i)),
    cities: parseCount(valueAfterLabel(lines, /^CITIES$/i)),
    occupancyPct: parsePct(valueAfterLabel(lines, /^OCCUPANCY$/i)),
    dayLabelText,
    freshnessText
  };
}

export function parseTrackedStats(lines: string[]): ParsedTrackedStats {
  const dayLabelText = lines.find((l) => /^Breakdown for:/i.test(l)) ?? null;
  const freshnessText = lines.find((l) => /^Updated\b/i.test(l)) ?? null;
  const completedShowsText = lines.find((l) => /^Completed shows till/i.test(l)) ?? null;
  return {
    todayGross: parseGrossCr(valueAfterLabel(lines, /^TODAY'S GROSS$/i)),
    lifetimeGross: parseGrossCr(valueAfterLabel(lines, /^LIFETIME GROSS$/i)),
    lifetimeTickets: parseCount(valueAfterLabel(lines, /^LIFETIME TICKETS$/i)),
    lifetimeShows: parseCount(valueAfterLabel(lines, /^LIFETIME SHOWS$/i)),
    cities: parseCount(valueAfterLabel(lines, /^CITIES$/i)),
    lifetimeOccupancyPct: parsePct(valueAfterLabel(lines, /^LIFETIME OCCUPANCY$/i)),
    dayLabelText,
    freshnessText,
    completedShowsText
  };
}

// ---------------------------------------------------------------------------
// Breakdown table (State Wise / Language Wise / Format Wise). Parsed from
// the actual <table> markup (cheerio row/cell walk) rather than the
// flattened line text, since tabular data is far more reliable to read
// straight off <tr>/<td> than to reconstruct from linearized text.
//
// IMPORTANT LIMITATION: State/Language/Format Wise are client-side tabs
// in MovieMint's UI (the same pattern FYRE's own BreakdownTable.tsx uses).
// A single rendered page only ever contains whichever tab is active by
// default -- this parser reads that one table and tags it with whichever
// of STATE/LANGUAGE/FORMAT its own header row says it is, rather than
// assuming a fixed tab. Capturing all three requires either navigating
// with tab clicks (not part of the plain-render retrieval this was built
// against -- see moviemintClient.ts) or MovieMint exposing them another
// way. Recorded as a known gap in the implementation report, not silently
// routed around.
// ---------------------------------------------------------------------------
export function parseBreakdownTable(html: string): ParsedBreakdownTable {
  const $ = cheerio.load(html);
  const rows: ParsedBreakdownRow[] = [];
  let total: ParsedBreakdownRow | null = null;
  let breakdownType: BreakdownType | null = null;

  $('table').each((_, table) => {
    const headerCells = $(table)
      .find('thead tr th, tr:first-child th, tr:first-child td')
      .map((__, el) => $(el).text().trim())
      .get();
    if (headerCells.length === 0) return;

    const firstHeader = (headerCells[0] ?? '').toUpperCase();
    let type: BreakdownType | null = null;
    if (firstHeader === 'STATE') type = 'state';
    else if (firstHeader === 'LANGUAGE') type = 'language';
    else if (firstHeader === 'FORMAT') type = 'format';
    if (!type) return; // not the breakdown table (could be an unrelated table on the page)
    breakdownType = type;

    const colIndex = (name: RegExp) => headerCells.findIndex((h) => name.test(h));
    const iGross = colIndex(/^GROSS$/i);
    const iShows = colIndex(/^SHOWS$/i);
    const iTickets = colIndex(/TICKETS SOLD/i);
    const iFf = colIndex(/^FF$/i);
    const iSoldOut = colIndex(/SOLD OUT/i);
    const iOcc = colIndex(/OCC/i);

    $(table)
      .find('tbody tr, tr')
      .each((__, tr) => {
        const cells = $(tr)
          .find('td')
          .map((___, td) => $(td).text().trim())
          .get();
        if (cells.length === 0) return;
        const label = cells[0];
        if (!label) return;

        const row: ParsedBreakdownRow = {
          breakdownType: type as BreakdownType,
          label,
          gross: iGross >= 0 ? parseGrossCr(cells[iGross]) : null,
          shows: iShows >= 0 ? parseCount(cells[iShows]) : null,
          ticketsSold: iTickets >= 0 ? parseCount(cells[iTickets]) : null,
          soldOut: iSoldOut >= 0 ? parseCount(cells[iSoldOut]) : null,
          occPct: iOcc >= 0 ? parsePct(cells[iOcc]) : null,
          rawFf: iFf >= 0 ? parseCount(cells[iFf]) : null
        };

        if (label.toUpperCase() === 'TOTAL') {
          total = row;
        } else {
          rows.push(row);
        }
      });
  });

  return { rows, total };
}

// ---------------------------------------------------------------------------
// Top-10 listing pages (/advance, /tracked) -- used for discovery
// (matching, see syncMovieMint.ts) and as a lightweight cross-check
// against the per-movie detail pages, not as the primary data source.
// ---------------------------------------------------------------------------
export type ParsedListingEntry = {
  rank: number | null;
  slug: string | null;
  title: string;
  gross: number | null;
};

export function parseListingSlugs(html: string): ParsedListingEntry[] {
  const $ = cheerio.load(html);
  const bySlug = new Map<string, ParsedListingEntry>();

  $('a[href^="/movie/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const slug = href.replace(/^\/movie\//, '').split(/[?#]/)[0];
    if (!slug || bySlug.has(slug)) return;
    const title = $(el).find('h1,h2,h3,h4').first().text().trim() || $(el).attr('title') || '';
    if (!title) return;
    bySlug.set(slug, { rank: null, slug, title, gross: null });
  });

  return Array.from(bySlug.values());
}

// ---------------------------------------------------------------------------
// Multiplex report (/multiplex-report). Best-effort line-scan: a chain
// section starts at an ALL-CAPS heading line, followed by a gross figure
// and a "N shows" line, followed by a small numbered per-movie table.
// Degrades to an empty array (rather than a partial/garbled parse) if the
// page doesn't match this shape -- this section is explicitly a "nice to
// have" per the investigation, not core data.
// ---------------------------------------------------------------------------
const MULTIPLEX_NON_CHAIN_HEADINGS = new Set([
  'LIVE TRACKING', 'DAILY MULTIPLEX REPORT', 'DATE', 'LATEST', 'THEATRES', 'GROSS', 'SHOWS'
]);

export function parseMultiplexReport(html: string): ParsedMultiplexChain[] {
  const lines = htmlToLines(html);
  const chains: ParsedMultiplexChain[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const isChainHeading =
      line === line.toUpperCase() &&
      /[A-Z]/.test(line) &&
      !MULTIPLEX_NON_CHAIN_HEADINGS.has(line) &&
      !/^\d/.test(line) &&
      line.length > 2;

    if (isChainHeading && i + 2 < lines.length && /^₹/.test(lines[i + 1])) {
      const chain = line;
      const totalGross = parseGrossCr(lines[i + 1]);
      // "35 shows" is usually 1-2 lines later (a "·" separator line may sit between).
      let showsIdx = i + 2;
      while (showsIdx < lines.length && !/shows$/i.test(lines[showsIdx]) && showsIdx < i + 4) showsIdx++;
      const totalShows = /shows$/i.test(lines[showsIdx] ?? '') ? parseCount(lines[showsIdx]) : null;

      const movies: ParsedMultiplexChain['movies'] = [];
      let j = showsIdx + 1;
      // Skip the mini-table's own header row ("#", "MOVIE", "GROSS", "SHOWS") if present.
      while (j < lines.length && ['#', 'MOVIE', 'GROSS', 'SHOWS'].includes(lines[j])) j++;

      while (j + 2 < lines.length) {
        const rankLine = lines[j];
        if (!/^\d+$/.test(rankLine)) break; // no more numbered rows -> next chain section (or end)
        const rawTitle = lines[j + 1] ?? '';
        const grossText = lines[j + 2] ?? '';
        const showsText = lines[j + 3] ?? '';
        if (!rawTitle || !/^₹/.test(grossText)) break;
        movies.push({ rawTitle, gross: parseGrossCr(grossText), shows: parseCount(showsText) });
        j += 4;
      }

      chains.push({ chain, totalGross, totalShows, movies });
      i = j;
      continue;
    }

    i++;
  }

  return chains;
}
