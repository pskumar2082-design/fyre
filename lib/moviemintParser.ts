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
// ---------------------------------------------------------------------------
// Movie detail pages (/movie/<slug>?kind=advance|tracked) ALSO embed their
// real data via the same Next.js Flight payload parseListingSlugs() reads
// -- confirmed live (2026-09-21): a `"data":{...}` object holding `config`
// (movieId/title/tmdbId/poster/backdrop/releaseDate/language/genres/
// region), `metadata` (source/lastUpdated), `summary` (today's/selected-
// date top-line totals), `dailySeries` (tracked only -- one entry per
// completed day since release), and `indiaStates` / `indiaLanguages` /
// `indiaFormats` (the State/Language/Format Wise breakdown tables -- ALL
// THREE at once, not just whichever tab a browser render happened to have
// open, which is strictly more than the old DOM-table scrape below could
// ever see in one render). Every function in this section prefers this
// Flight data and only falls back to the original render/text-based
// parsing when it isn't present (a page shape this investigation hasn't
// seen, or a genuinely un-rendered shell).
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// "2026-09-17" -> "Release: September 17, 2026", matching the exact text
// shape syncMovieMint.ts's parseReleaseDateText() regex already expects,
// so downstream parsing keeps working unchanged regardless of which path
// (Flight or DOM fallback) produced this string.
function formatIsoDateToReleaseText(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const monthName = MONTH_NAMES[Number(m[2]) - 1];
  if (!monthName) return null;
  return `Release: ${monthName} ${Number(m[3])}, ${m[1]}`;
}

// "20260924" -> "September 24, 2026", for building dayLabelText strings
// that still satisfy syncMovieMint.ts's parseDayLabelDate() regex (it only
// looks for a "Month D, YYYY" substring -- the surrounding prefix text is
// free-form).
function formatCompactDateText(yyyymmdd: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(yyyymmdd);
  if (!m) return null;
  const monthName = MONTH_NAMES[Number(m[2]) - 1];
  if (!monthName) return null;
  return `${monthName} ${Number(m[3])}, ${m[1]}`;
}

type FlightPageData = {
  config?: {
    title?: unknown;
    releaseDate?: unknown;
    language?: unknown;
    genres?: unknown;
    poster?: unknown;
  };
  metadata?: { lastUpdated?: unknown };
  summary?: {
    totalGross?: unknown;
    totalShows?: unknown;
    totalTicketsSold?: unknown;
    totalSeats?: unknown;
    totalLocations?: unknown;
    avgOccupancy?: unknown;
  };
  indiaStates?: unknown;
  indiaLanguages?: unknown;
  indiaFormats?: unknown;
  dailySeries?: unknown;
  selectedDate?: unknown;
  completedMode?: unknown;
  completedAsOf?: unknown;
};

// Same quote/escape-aware balanced scan as extractBalancedArrayText, for a
// JSON object value (`{...}`) instead of an array.
function extractBalancedObjectText(text: string, startIdx: number): string {
  let depth = 0;
  let inStr = false;
  let esc = false;
  let i = startIdx;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
  }
  return text.slice(startIdx, i);
}

// A movie detail page's whole Flight-embedded state lives under one
// top-level `"data":{...}` key (both ?kind=advance and ?kind=tracked --
// confirmed live for both). Returns null when that key isn't present at
// all (not a movie detail page, or a genuinely un-rendered shell with no
// embedded data yet), never when it's merely empty -- an explicit
// `indiaStates: []` means "MovieMint has nothing to report for this
// date", a real and different answer from "couldn't find any data".
function extractFlightPageData(html: string): FlightPageData | null {
  const flightText = extractFlightText(html);
  // MovieMint's Flight payload nests page metadata (config/summary/breakdowns)
  // under "data", but dailySeries/selectedDate/completedMode/completedAsOf/
  // availableDates/todayDate/advanceHref/trackedHref are SIBLINGS of "data",
  // not children of it. Locate the true outer object (the one containing
  // "data" as a property) via the ",null,{" wrapper Next.js emits around it,
  // then flatten data's fields together with its siblings so downstream
  // parsers (which expect a single flat object) see everything.
  const marker = ',null,{"data":{';
  const markerIdx = flightText.indexOf(marker);
  if (markerIdx === -1) return null;

  const objStart = markerIdx + ',null,'.length; // index of the outer '{'
  const objText = extractBalancedObjectText(flightText, objStart);
  try {
    const parsed = JSON.parse(objText) as { data?: Record<string, unknown> } & Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    const { data: inner, ...outer } = parsed;
    return { ...(inner ?? {}), ...outer } as FlightPageData;
  } catch {
    return null;
  }
}

function parseMovieMetaFromLines(lines: string[]): ParsedMovieMeta {
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

export function parseMovieMeta(html: string): ParsedMovieMeta {
  const data = extractFlightPageData(html);
  const cfg = data?.config;
  if (cfg && typeof cfg.title === 'string' && cfg.title) {
    const releaseDateText = typeof cfg.releaseDate === 'string' ? formatIsoDateToReleaseText(cfg.releaseDate) : null;
    const genres = Array.isArray(cfg.genres)
      ? (cfg.genres as unknown[]).filter((g): g is string => typeof g === 'string' && g.length > 0)
      : [];
    return {
      title: cfg.title,
      releaseDateText,
      language: typeof cfg.language === 'string' && cfg.language ? cfg.language : null,
      genre: genres.length > 0 ? genres.join(', ') : null
    };
  }
  return parseMovieMetaFromLines(htmlToLines(html));
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

// MovieMint sources posters from TMDB. The per-movie page's embedded
// Flight JSON (see extractFlightPageData) carries the poster directly at
// config.poster -- confirmed live 2026-09-21 against /movie/gdn -- and
// this is present even on the fast plain-HTTP (non-rendered) path, where
// there's no real <img> tag for it at all (only the site's own logo
// image is server-rendered; the poster <img> is mounted client-side
// after hydration). Checking config.poster first means posters populate
// even for movies whose sync never needed a full Chromium render.
// Falls back to scanning every <img> in the page (the old approach,
// still useful if a page's poster ever shows up only that way) --
// either a direct image.tmdb.org URL or one wrapped in Next.js's own
// image proxy (/_next/image?url=<encoded-tmdb-url>&w=...&q=...).
export function parsePosterUrl(html: string): string | null {
  const data = extractFlightPageData(html);
  const cfgPoster = data?.config?.poster;
  if (typeof cfgPoster === 'string' && cfgPoster.includes('image.tmdb.org')) {
    return cfgPoster;
  }

  const $ = cheerio.load(html);
  let found: string | null = null;

  $('img').each((_, el) => {
    if (found) return;
    const src = $(el).attr('src');
    if (!src) return;

    // Checked before the plain-domain match below: encodeURIComponent
    // leaves letters and dots unescaped, so a wrapped URL's query string
    // still contains the literal substring "image.tmdb.org" even though
    // src itself is a /_next/image path, not a direct one -- matching
    // the plain check first would wrongly keep the un-unwrapped proxy
    // URL as `found` instead of the real TMDB URL underneath it.
    if (src.includes('/_next/image') && src.includes('url=')) {
      try {
        const u = new URL(src, 'https://moviemintbo.com');
        const inner = u.searchParams.get('url');
        if (inner && inner.includes('image.tmdb.org')) {
          found = decodeURIComponent(inner);
          return;
        }
      } catch {
        // Malformed src -- skip, keep looking at other <img> tags.
      }
    }

    if (src.includes('image.tmdb.org')) {
      found = src.startsWith('http') ? src : `https://moviemintbo.com${src}`;
    }
  });

  return found;
}

function parseAdvanceStatsFromLines(lines: string[]): ParsedAdvanceStats {
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

export function parseAdvanceStats(html: string): ParsedAdvanceStats {
  const data = extractFlightPageData(html);
  const s = data?.summary;
  if (s && typeof s === 'object') {
    const dayLabelText =
      typeof data?.selectedDate === 'string'
        ? (() => {
            const d = formatCompactDateText(data.selectedDate as string);
            return d ? `Advance data: ${d}` : null;
          })()
        : null;
    const freshnessText =
      data?.metadata && typeof data.metadata.lastUpdated === 'string' ? `Updated ${data.metadata.lastUpdated}` : null;
    return {
      gross: typeof s.totalGross === 'number' ? s.totalGross / 1e7 : null,
      tickets: typeof s.totalTicketsSold === 'number' ? s.totalTicketsSold : null,
      shows: typeof s.totalShows === 'number' ? s.totalShows : null,
      cities: typeof s.totalLocations === 'number' ? s.totalLocations : null,
      occupancyPct: typeof s.avgOccupancy === 'number' ? s.avgOccupancy : null,
      dayLabelText,
      freshnessText
    };
  }
  return parseAdvanceStatsFromLines(htmlToLines(html));
}

function parseTrackedStatsFromLines(lines: string[]): ParsedTrackedStats {
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

// Sums a numeric field across dailySeries entries -- tolerant of any entry
// missing or mistyping the field (adds 0 for that entry rather than
// throwing/NaN-ing the whole total).
function sumSeriesField(series: unknown[], field: string): number {
  let total = 0;
  for (const entry of series) {
    if (entry && typeof entry === 'object') {
      const v = (entry as Record<string, unknown>)[field];
      if (typeof v === 'number') total += v;
    }
  }
  return total;
}

export function parseTrackedStats(html: string): ParsedTrackedStats {
  const data = extractFlightPageData(html);
  const s = data?.summary;
  const series = data && Array.isArray(data.dailySeries) ? (data.dailySeries as unknown[]) : null;
  if (s && typeof s === 'object' && series) {
    // `summary` reflects only the currently *selected* date (today, by
    // default) -- `dailySeries` is every day up to (but not necessarily
    // including) that date, since a day only rolls into the series once
    // it's complete. Add `summary` on top of the series sum for the true
    // lifetime-to-date total, but only when today isn't already the
    // series' own last entry, so a day that HAS rolled in is never
    // double-counted.
    const lastEntry = series.length > 0 ? (series[series.length - 1] as Record<string, unknown>) : null;
    const lastSeriesDate = lastEntry && typeof lastEntry.date === 'string' ? lastEntry.date : null;
    const includeSummary = typeof data?.selectedDate !== 'string' || data.selectedDate !== lastSeriesDate;

    const seriesGross = sumSeriesField(series, 'gross');
    const seriesTickets = sumSeriesField(series, 'ticketsSold');
    const seriesShows = sumSeriesField(series, 'shows');
    const seriesSeats = sumSeriesField(series, 'totalSeats');

    const summaryGross = typeof s.totalGross === 'number' ? s.totalGross : 0;
    const summaryTickets = typeof s.totalTicketsSold === 'number' ? s.totalTicketsSold : 0;
    const summaryShows = typeof s.totalShows === 'number' ? s.totalShows : 0;
    const summarySeats = typeof s.totalSeats === 'number' ? s.totalSeats : 0;

    const lifetimeGrossRupees = seriesGross + (includeSummary ? summaryGross : 0);
    const lifetimeTickets = seriesTickets + (includeSummary ? summaryTickets : 0);
    const lifetimeShows = seriesShows + (includeSummary ? summaryShows : 0);
    const lifetimeSeats = seriesSeats + (includeSummary ? summarySeats : 0);

    const dayLabelText =
      typeof data?.selectedDate === 'string'
        ? (() => {
            const d = formatCompactDateText(data.selectedDate as string);
            return d ? `Breakdown for: ${d}` : null;
          })()
        : null;
    const freshnessText =
      data?.metadata && typeof data.metadata.lastUpdated === 'string' ? `Updated ${data.metadata.lastUpdated}` : null;
    const completedShowsText =
      data?.completedMode === true && typeof data.completedAsOf === 'string'
        ? `Completed shows till ${data.completedAsOf}`
        : null;

    return {
      todayGross: typeof s.totalGross === 'number' ? s.totalGross / 1e7 : null,
      lifetimeGross: lifetimeGrossRupees / 1e7,
      lifetimeTickets,
      lifetimeShows,
      cities: typeof s.totalLocations === 'number' ? s.totalLocations : null,
      // Weighted (tickets/seats), not a plain mean of each day's
      // avgOccupancy -- gives every ticket equal weight instead of every
      // day equal weight, which is what "lifetime occupancy" should mean.
      lifetimeOccupancyPct: lifetimeSeats > 0 ? Math.round((lifetimeTickets / lifetimeSeats) * 1000) / 10 : null,
      dayLabelText,
      freshnessText,
      completedShowsText
    };
  }
  return parseTrackedStatsFromLines(htmlToLines(html));
}

// One entry per day MovieMint has already rolled into its completed-day
// series (see the FlightPageData comment above) -- i.e. real day-by-day
// history since release, not just the single latest/lifetime snapshot
// parseTrackedStats derives from `summary`. Each entry carries its OWN
// lastUpdated text (not the page's overall metadata.lastUpdated), so
// syncMovieMint.ts can give every historical source_snapshots row its own
// accurate source_captured_at instead of stamping all of history with
// today's fetch time. Only present on ?kind=tracked pages -- always []
// when the Flight payload has no dailySeries (advance pages, or a page
// shape this hasn't seen).
export type ParsedDailySeriesEntry = {
  dateIso: string | null; // "2026-09-02"
  gross: number | null; // Cr, same unit as every other gross field here
  tickets: number | null;
  shows: number | null;
  occupancyPct: number | null;
  capacity: number | null; // total seats across that day's shows
  lastUpdatedText: string | null; // e.g. "2026-09-02 23:39 IST" -- that day's own freshness stamp
};

export function parseDailySeries(html: string): ParsedDailySeriesEntry[] {
  const data = extractFlightPageData(html);
  const series = data && Array.isArray(data.dailySeries) ? (data.dailySeries as unknown[]) : [];
  const out: ParsedDailySeriesEntry[] = [];
  for (const raw of series) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    const dateCompact = typeof e.date === 'string' ? e.date : null;
    const m = dateCompact ? /^(\d{4})(\d{2})(\d{2})$/.exec(dateCompact) : null;
    out.push({
      dateIso: m ? `${m[1]}-${m[2]}-${m[3]}` : null,
      gross: typeof e.gross === 'number' ? e.gross / 1e7 : null,
      tickets: typeof e.ticketsSold === 'number' ? e.ticketsSold : null,
      shows: typeof e.shows === 'number' ? e.shows : null,
      occupancyPct: typeof e.avgOccupancy === 'number' ? e.avgOccupancy : null,
      capacity: typeof e.totalSeats === 'number' ? e.totalSeats : null,
      lastUpdatedText: typeof e.lastUpdated === 'string' ? e.lastUpdated : null
    });
  }
  return out;
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
function parseBreakdownTableFromDom(html: string): ParsedBreakdownTable {
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

// Field names confirmed live in indiaStates/indiaLanguages/indiaFormats
// (2026-09-21): indiaStates carries `fastFilling`/`houseFull`, which map
// directly onto the DOM table's "FF" (see ParsedBreakdownRow.rawFf's own
// comment -- previously unconfirmed, now confirmed: FF = fastFilling) and
// "SOLD OUT" (-> houseFull) columns. indiaLanguages/indiaFormats don't
// carry either of those two fields -- the DOM table version never exposed
// a Language/Format Wise FF or Sold Out column either, so this isn't a
// regression.
function flightRowsFromArray(arr: unknown, breakdownType: BreakdownType, labelField: string): ParsedBreakdownRow[] {
  if (!Array.isArray(arr)) return [];
  const rows: ParsedBreakdownRow[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const label = typeof r[labelField] === 'string' ? (r[labelField] as string) : null;
    if (!label) continue;
    rows.push({
      breakdownType,
      label,
      gross: typeof r.gross === 'number' ? r.gross / 1e7 : null,
      shows: typeof r.shows === 'number' ? r.shows : null,
      ticketsSold: typeof r.ticketsSold === 'number' ? r.ticketsSold : null,
      soldOut: typeof r.houseFull === 'number' ? r.houseFull : null,
      occPct: typeof r.occupancy === 'number' ? r.occupancy : null,
      rawFf: typeof r.fastFilling === 'number' ? r.fastFilling : null
    });
  }
  return rows;
}

export function parseBreakdownTable(html: string): ParsedBreakdownTable {
  const data = extractFlightPageData(html);
  if (data && Array.isArray(data.indiaStates)) {
    // Flight data offers State, Language AND Format Wise simultaneously --
    // strictly more than a single DOM render could ever show (only
    // whichever tab happened to be active by default). `total` is left
    // null here, same as most DOM-parsed pages already produced in
    // practice (syncMovieMint.ts never reads it): one summary-derived
    // total wouldn't cleanly apply across three different breakdown
    // dimensions at once the way a single DOM table's own TOTAL row did.
    const rows = [
      ...flightRowsFromArray(data.indiaStates, 'state', 'name'),
      ...flightRowsFromArray(data.indiaLanguages, 'language', 'language'),
      ...flightRowsFromArray(data.indiaFormats, 'format', 'format')
    ];
    return { rows, total: null };
  }
  return parseBreakdownTableFromDom(html);
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

// ---------------------------------------------------------------------------
// Next.js (App Router) embeds each page's server-fetched data directly in
// the initial HTML response as React's "Flight" payload: a series of
// self.__next_f.push([id, "<chunk>"]) calls whose string chunks
// concatenate into one stream containing plain JSON fragments (e.g.
// `11:["$","$L21",null,{"movies":[{...}, ...]}]`).
//
// Confirmed live (2026-09-21): /tracked's ENTIRE "movies" array --
// boxOfficeId, title, poster, releaseDate, language, gross, ticketsSold,
// shows, avgOccupancy, topState, every field this project needs -- is
// present this way in a single plain HTTP response, no browser render
// required. /advance does NOT embed its Top 10 this way (confirmed: zero
// "gross" keys anywhere in its payload) -- that listing is genuinely
// client-fetched after mount, so extractFlightMovies() correctly returns
// null there and the caller below falls back to DOM scraping (which also
// then legitimately finds nothing from a pre-render shell -- the correct
// "not real data yet" signal, see moviemintClient.ts's
// looksLikeRealRawData).
// ---------------------------------------------------------------------------

// Scans for every self.__next_f.push([id, "chunk"]) call via a
// quote/escape-aware balanced-paren scan (not a regex -- a chunk's own
// string content can contain arbitrary nested quotes/backslashes), parses
// each call's `[id, "chunk"]` array as JSON (valid JSON syntax -- React
// writes it with JSON.stringify), and concatenates the chunks in order.
function extractFlightText(html: string): string {
  const marker = 'self.__next_f.push(';
  const chunks: string[] = [];
  let searchFrom = 0;

  while (true) {
    const pushIdx = html.indexOf(marker, searchFrom);
    if (pushIdx === -1) break;
    const openParen = pushIdx + marker.length - 1;

    let i = openParen;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (; i < html.length; i++) {
      const c = html[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === '(') depth++;
        else if (c === ')') {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
    }

    const call = html.slice(openParen + 1, i - 1);
    try {
      const parsed = JSON.parse(call);
      if (Array.isArray(parsed) && typeof parsed[1] === 'string') chunks.push(parsed[1]);
    } catch {
      // Not a well-formed [id, "chunk"] pair -- skip it rather than fail
      // the whole extraction over one malformed push() call.
    }
    searchFrom = i;
  }

  return chunks.join('');
}

// Same quote/escape-aware balanced scan, this time for a JSON array value
// (`[...]`) starting at a known index within already-concatenated flight
// text.
function extractBalancedArrayText(text: string, startIdx: number): string {
  let depth = 0;
  let inStr = false;
  let esc = false;
  let i = startIdx;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else {
      if (c === '"') inStr = true;
      else if (c === '[') depth++;
      else if (c === ']') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
  }
  return text.slice(startIdx, i);
}

type FlightMovieRecord = {
  boxOfficeId?: unknown;
  title?: unknown;
  href?: unknown;
  gross?: unknown;
};

function extractFlightMovies(html: string): FlightMovieRecord[] | null {
  const flightText = extractFlightText(html);
  const key = '"movies":[';
  const keyIdx = flightText.indexOf(key);
  if (keyIdx === -1) return null;

  const arrStart = keyIdx + key.length - 1; // index of the '['
  const arrText = extractBalancedArrayText(flightText, arrStart);
  try {
    const parsed: unknown = JSON.parse(arrText);
    return Array.isArray(parsed) ? (parsed as FlightMovieRecord[]) : null;
  } catch {
    return null;
  }
}

export function parseListingSlugs(html: string): ParsedListingEntry[] {
  const flightMovies = extractFlightMovies(html);
  if (flightMovies && flightMovies.length > 0) {
    const entries: ParsedListingEntry[] = [];
    flightMovies.forEach((m, i) => {
      const title = typeof m.title === 'string' ? m.title : '';
      const slug =
        typeof m.boxOfficeId === 'string'
          ? m.boxOfficeId
          : typeof m.href === 'string'
            ? m.href.replace(/^\/movie\//, '').split(/[?#]/)[0]
            : null;
      if (!slug || !title) return;
      // MovieMint's embedded gross is a raw rupee amount (e.g.
      // 129985597.46); every other gross figure in this codebase is in
      // Crores (see parseGrossCr), so convert here to keep that
      // convention consistent for anything comparing/displaying this
      // value later.
      const gross = typeof m.gross === 'number' ? m.gross / 1e7 : null;
      entries.push({ rank: i + 1, slug, title, gross });
    });
    if (entries.length > 0) return entries;
  }

  // Fallback: DOM-based scraping. What runs for a listing page that
  // doesn't embed its data via the Flight payload (e.g. /advance) -- and
  // correctly returns empty there, since a pre-render loading shell has
  // no real <a href="/movie/..."> links either. Also the path for any
  // future page shape this investigation hasn't seen.
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
