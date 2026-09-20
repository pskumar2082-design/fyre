import type {
  ParsedAdvanceStats,
  ParsedTrackedStats,
  ParsedBreakdownRow,
  ParsedMultiplexChain
} from '@/lib/moviemintParser';

// ---------------------------------------------------------------------------
// Normalizes moviemintParser.ts output into the shapes
// supabase/migration_moviemint.sql's tables expect. No HTTP, no DB calls --
// syncMovieMint.ts owns actually writing these. Never invents a value: a
// metric MovieMint didn't show stays `null` all the way through, it's
// never coerced to 0.
// ---------------------------------------------------------------------------

export type MappedSnapshot = {
  source: 'moviemint';
  kind: 'advance' | 'tracked';
  market: string;
  sourceCapturedAt: string | null; // ISO timestamp, best-effort parse of the source's own freshness text
  gross: number | null;
  tickets: number | null;
  shows: number | null;
  theatres: number | null; // MovieMint's movie-detail pages didn't expose a theatre count distinct from shows/cities
  cities: number | null;
  capacity: number | null; // not exposed by MovieMint anywhere confirmed -- always null
  occupancy: number | null;
  sourceUpdatedText: string | null;
};

export type MappedBreakdownRow = {
  source: 'moviemint';
  breakdownType: ParsedBreakdownRow['breakdownType'];
  label: string;
  gross: number | null;
  shows: number | null;
  ticketsSold: number | null;
  soldOut: number | null;
  occPct: number | null;
  rawFf: number | null;
};

export type MappedMultiplexRow = {
  rawTitle: string;
  chain: string;
  gross: number | null;
  shows: number | null;
};

const MARKET = 'India'; // only market confirmed live on MovieMint's data pages during investigation

// "Updated 1h 5m ago" / "Updated 4m ago" -> an ISO timestamp relative to now.
// Best-effort: if the text doesn't match, returns null rather than a guess.
export function parseFreshnessToTimestamp(text: string | null, now: Date = new Date()): string | null {
  if (!text) return null;
  const m = text.match(/Updated\s+(?:(\d+)h\s*)?(?:(\d+)m\s*)?ago/i);
  if (!m) return null;
  const hours = m[1] ? Number(m[1]) : 0;
  const minutes = m[2] ? Number(m[2]) : 0;
  if (hours === 0 && minutes === 0 && !/^Updated\s+ago/i.test(text)) {
    // "Updated ago" alone with no number isn't a real match; require at
    // least one of h/m to have actually been captured.
    if (!m[1] && !m[2]) return null;
  }
  const ms = now.getTime() - (hours * 3600 + minutes * 60) * 1000;
  return new Date(ms).toISOString();
}

// "Completed shows till 20:43 IST" -> today's date (IST, UTC+5:30) at that
// time, as an ISO timestamp. Best-effort: MovieMint only ever showed IST
// times in what was captured, so this assumes IST rather than parsing a
// timezone abbreviation generically.
export function parseCompletedShowsTimestamp(text: string | null, referenceDate: Date = new Date()): string | null {
  if (!text) return null;
  const m = text.match(/till\s+(\d{1,2}):(\d{2})\s*IST/i);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  // Build the IST wall-clock time on referenceDate's IST calendar day, then
  // convert to UTC (IST = UTC+5:30) for storage.
  const istNow = new Date(referenceDate.getTime() + 5.5 * 3600 * 1000);
  const istYear = istNow.getUTCFullYear();
  const istMonth = istNow.getUTCMonth();
  const istDay = istNow.getUTCDate();
  const istTimestampMs = Date.UTC(istYear, istMonth, istDay, hh, mm) - 5.5 * 3600 * 1000;
  return new Date(istTimestampMs).toISOString();
}

export function mapAdvanceSnapshot(stats: ParsedAdvanceStats): MappedSnapshot {
  return {
    source: 'moviemint',
    kind: 'advance',
    market: MARKET,
    sourceCapturedAt: parseFreshnessToTimestamp(stats.freshnessText),
    gross: stats.gross,
    tickets: stats.tickets,
    shows: stats.shows,
    theatres: null,
    cities: stats.cities,
    capacity: null,
    occupancy: stats.occupancyPct,
    sourceUpdatedText: stats.freshnessText ?? stats.dayLabelText
  };
}

export function mapTrackedSnapshot(stats: ParsedTrackedStats): MappedSnapshot {
  const capturedAt =
    parseCompletedShowsTimestamp(stats.completedShowsText) ?? parseFreshnessToTimestamp(stats.freshnessText);
  return {
    source: 'moviemint',
    kind: 'tracked',
    market: MARKET,
    sourceCapturedAt: capturedAt,
    // "Today's Gross" is the closest analog to a live snapshot value;
    // lifetime_* fields are also captured here (see MappedSnapshot ->
    // now_showing caching in syncMovieMint.ts) but the snapshot's headline
    // gross is today's, matching what a same-day velocity chart needs.
    gross: stats.todayGross,
    tickets: stats.lifetimeTickets,
    shows: stats.lifetimeShows,
    theatres: null,
    cities: stats.cities,
    capacity: null,
    occupancy: stats.lifetimeOccupancyPct,
    sourceUpdatedText: stats.completedShowsText ?? stats.freshnessText ?? stats.dayLabelText
  };
}

export function mapBreakdownRow(row: ParsedBreakdownRow): MappedBreakdownRow {
  return {
    source: 'moviemint',
    breakdownType: row.breakdownType,
    label: row.label,
    gross: row.gross,
    shows: row.shows,
    ticketsSold: row.ticketsSold,
    soldOut: row.soldOut,
    occPct: row.occPct,
    rawFf: row.rawFf
  };
}

export function mapMultiplexChain(chain: ParsedMultiplexChain): MappedMultiplexRow[] {
  return chain.movies.map((m) => ({
    rawTitle: m.rawTitle,
    chain: chain.chain,
    gross: m.gross,
    shows: m.shows
  }));
}

// Normalizes a title for matching -- strips a trailing language-code
// parenthetical MovieMint adds on the multiplex report ("Resident Evil
// (E)" -> "resident evil"), lowercases, and collapses whitespace/punctuation.
// Used only for matching, never for display.
export function normalizeTitleForMatch(title: string): string {
  return title
    .replace(/\s*\([A-Za-z]{1,3}\)\s*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
