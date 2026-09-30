// Pure conversion of stored BFILMY data (bf_movie / bf_movie_days /
// bf_movie_cumulative, see supabase/migration_bfilmy.sql) into the movie
// shapes every fyre page, the compare feature and the poster tool already
// consume (TTListedMovie / TTMovieDetails). Keeping those shapes means the
// switch from TrackTollywood to BFILMY doesn't ripple through every page.
//
// Table labels deliberately follow the conventions lib/boxoffice/
// tableGroups.ts groups by -- "<Category> — Day N", "Day-wise
// Collection", "Cumulative <Category>", "Advance YYYY-MM-DD — <Category>"
// -- so the movie page's Report/Breakdown pickers, compare tabs and poster
// report list work unchanged.
import type { TTLazyDay, TTListedMovie, TTMovieDetails, TTMovieMetaItem, TTMovieState, TTStat, TTTable, TTTableRow } from '@/lib/boxoffice/types';
import { chainFromTuple, cityFromTuple, finalizeFigures } from './normalize';
import type { BfCityRow, BfFigures, BfNamedRow } from './types';

// ---------------------------------------------------------------------------
// Stored row shapes (as returned by Supabase)
// ---------------------------------------------------------------------------

export type BfDaySnapshot = Partial<BfFigures> & { date?: string; cities?: number; languages?: string[]; formats?: string[] };

export type BfMovieRow = {
  slug: string;
  title: string;
  languages: string[] | null;
  formats: string[] | null;
  poster: string | null;
  release_date: string | null;
  premiere_date?: string | null; // the day just before Day 1, if it had shows (Day 0)
  carried_over?: boolean | null; // already running when the archive starts (2025-01-01)
  first_date: string | null;
  last_date: string | null;
  days_tracked: number | null;
  total_gross: number | string | null;
  total_sold: number | string | null;
  total_shows: number | string | null;
  total_seats: number | string | null;
  latest: BfDaySnapshot | null;
  best: BfDaySnapshot | null;
  advance: BfDaySnapshot | null;
  advance_date: string | null;
  source_updated: string | null;
};

export type BfStoredDay = {
  kind: 'boxoffice' | 'advance';
  date: string;
  totals: BfDaySnapshot;
  // null = not loaded (the movie page loads older days on demand)
  breakdown: null | {
    states?: Partial<BfNamedRow>[];
    formats?: Partial<BfNamedRow>[];
    languages?: Partial<BfNamedRow>[];
    cities?: unknown[][];
    chains?: unknown[][];
  };
  source_updated?: string | null;
};

export type BfCumulative = {
  states?: Partial<BfNamedRow>[];
  formats?: Partial<BfNamedRow>[];
  languages?: Partial<BfNamedRow>[];
  cities?: unknown[][];
  chains?: unknown[][];
  cityCount?: number;
  chainCount?: number;
};

// ---------------------------------------------------------------------------
// Formatting (same conventions TrackTollywood's figures used, so existing
// parsers -- parseAmountToCr, the poster's parseGrossToRupees, compare's
// numeric sort -- keep working)
// ---------------------------------------------------------------------------

function n(v: unknown): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

// Headline money: "₹4.98 Cr" / "₹42.40 L" / "₹9,300".
export function formatMoney(rupees: number): string {
  if (rupees >= 1e7) return `₹${(rupees / 1e7).toFixed(2)} Cr`;
  if (rupees >= 1e5) return `₹${(rupees / 1e5).toFixed(2)} L`;
  return `₹${Math.round(rupees).toLocaleString('en-IN')}`;
}

// Table cells: plain rupees under a "Gross (₹)" header, Indian grouping --
// one unit for every row so comparisons and sorting are exact.
export function formatRupeeCell(rupees: number): string {
  return Math.round(rupees).toLocaleString('en-IN');
}

export function formatCount(v: number): string {
  return Math.round(v).toLocaleString('en-IN');
}

export function formatPct(v: number): string {
  return `${(Math.round(v * 100) / 100).toFixed(2)}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "2026-09-26" -> "26 Sep 2026" (the format parseReleaseDate reads).
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[(m || 1) - 1]} ${y}`;
}

function weekday(iso: string): string {
  return WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

// Day N of a run, counted in calendar days from the first box-office date.
export function dayNumber(date: string, firstDate: string): number {
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${firstDate}T00:00:00Z`)) / 86_400_000);
  return diff + 1;
}

// The Day 1 date for a released movie: the release date the database
// worked out (bf_refresh_movies -- past stray early shows), falling back to
// the first box-office date. The day before it, if it had shows, is Day 0.
export function dayOneDate(row: Pick<BfMovieRow, 'first_date' | 'release_date' | 'carried_over'>): string | null {
  if (!row.first_date || row.carried_over) return null;
  return row.release_date && row.release_date >= row.first_date ? row.release_date : row.first_date;
}

// BFILMY's public archive starts here. A film already running on this date
// was released earlier: its release date and pre-2025 collections are
// unknown, so its figures are shown as "since 1 Jan 2025", never as
// lifetime numbers or with invented Day counts.
export const ARCHIVE_START = '2025-01-01';
const SINCE_ARCHIVE = 'Tracked gross since 1 Jan 2025';

// Report headings stay "Day N" (including "Day 0") because the movie
// page's grouping matches /^Day \d+$/. Day 0 is the day just before
// release. It's called pre-release, not "premieres", because BFILMY's
// data can't tell paid premieres from other early shows.
export function dayName(n: number): string {
  return n <= 0 ? 'Day 0 (Pre-release)' : `Day ${n}`;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// live   -- box-office data for today or yesterday (India time)
// advance -- not released yet, advance bookings open for today or later
// final  -- released, no box-office data since before yesterday
// unknown -- advance bookings that lapsed without any release (excluded
//            from listings)
export function movieState(row: Pick<BfMovieRow, 'first_date' | 'last_date' | 'advance_date'>, today: string): TTMovieState {
  const yesterday = addDays(today, -1);
  if (row.last_date && row.last_date >= yesterday) return 'live';
  if (!row.first_date) return row.advance_date && row.advance_date >= today ? 'advance' : 'unknown';
  return 'final';
}

function primaryLanguages(row: BfMovieRow, max = 3): string | null {
  const langs = (row.languages ?? []).filter(Boolean);
  if (langs.length === 0) return null;
  return langs.length > max ? `${langs.slice(0, max).join(', ')} +${langs.length - max}` : langs.join(', ');
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export function listedFromRow(row: BfMovieRow, today: string): TTListedMovie {
  const state = movieState(row, today);
  const released = !!row.first_date;
  const grossRupees = released ? n(row.total_gross) : n(row.advance?.gross);
  const anchor = dayOneDate(row);
  // Running: the calendar day of the run. Finished: how many days it had
  // shows (a stray screening weeks later would otherwise read as a
  // 150-day run).
  const dayLabel =
    anchor && row.last_date
      ? state === 'live'
        ? dayName(dayNumber(row.last_date, anchor))
        : `${n(row.days_tracked)} days`
      : null;
  const todayGross = state === 'live' && row.latest?.date === today ? n(row.latest.gross) : null;

  return {
    slug: row.slug,
    title: row.title,
    url: `/movie/${row.slug}`,
    state,
    dayLabel,
    releaseText: row.release_date && !row.carried_over ? `${released ? 'Released' : 'Releasing'} ${formatDate(row.release_date)}` : null,
    genre: primaryLanguages(row),
    poster: row.poster,
    grossLabel: row.carried_over ? SINCE_ARCHIVE : released ? 'Tracked Gross' : 'Advance Gross',
    gross: grossRupees > 0 ? formatMoney(grossRupees) : null,
    grossCr: grossRupees > 0 ? Math.round((grossRupees / 1e7) * 100) / 100 : null,
    todayText: todayGross != null ? formatMoney(todayGross) : null,
    updatedText: row.source_updated ? `Upd ${row.source_updated}` : null
  };
}

// ---------------------------------------------------------------------------
// Detail tables
// ---------------------------------------------------------------------------

const METRIC_HEADERS = ['Gross (₹)', 'Tickets', 'Shows', 'Occupancy'];

function metricCells(f: Partial<BfFigures>): Record<string, string> {
  const fig = finalizeFigures({
    gross: n(f.gross),
    sold: n(f.sold),
    shows: n(f.shows),
    totalSeats: n(f.totalSeats),
    fastfilling: n(f.fastfilling),
    housefull: n(f.housefull),
    occupancy: 0
  });
  return {
    'Gross (₹)': formatRupeeCell(fig.gross),
    Tickets: formatCount(fig.sold),
    Shows: formatCount(fig.shows),
    Occupancy: formatPct(fig.occupancy)
  };
}

function namedTable(label: string, nameHeader: string, rows: Partial<BfNamedRow>[] | undefined): TTTable | null {
  const list = (rows ?? []).filter((r) => r && r.name);
  if (list.length === 0) return null;
  return {
    label,
    headers: [nameHeader, ...METRIC_HEADERS],
    rows: list.map((r) => ({ [nameHeader]: String(r.name), ...metricCells(r) }) as TTTableRow)
  };
}

function citiesTable(label: string, tuples: unknown[][] | undefined): TTTable | null {
  const list: BfCityRow[] = (tuples ?? []).filter(Array.isArray).map((t) => cityFromTuple(t));
  if (list.length === 0) return null;
  return {
    label,
    headers: ['#', 'City', 'State', ...METRIC_HEADERS],
    rows: list.map((c, i) => ({ '#': String(i + 1), City: c.name, State: c.state ?? '', ...metricCells(c) }) as TTTableRow)
  };
}

function chainsTable(label: string, tuples: unknown[][] | undefined): TTTable | null {
  const list = (tuples ?? []).filter(Array.isArray).map((t) => chainFromTuple(t));
  return namedTable(label, 'Chain', list);
}

// The per-date breakdown set, in the order the movie page shows them.
function breakdownTables(suffixOrPrefix: (category: string) => string, b: NonNullable<BfStoredDay['breakdown']> | BfCumulative): TTTable[] {
  return [
    namedTable(suffixOrPrefix('State-wise'), 'State', b.states),
    citiesTable(suffixOrPrefix('Top Cities'), b.cities),
    chainsTable(suffixOrPrefix('Chain-wise'), b.chains),
    namedTable(suffixOrPrefix('Language-wise'), 'Language', b.languages),
    namedTable(suffixOrPrefix('Format-wise'), 'Format', b.formats)
  ].filter((t): t is TTTable => t != null);
}

// Day label for one box-office date: Day N from Day 1, "Day 0
// (Pre-release)" for the day just before it, "Pre-release" for earlier
// stray shows, and blank when the release date is unknown.
function dayLabelFor(date: string, dayOne: string | null, premiereDate: string | null | undefined): string {
  if (!dayOne) return '';
  if (premiereDate && date === premiereDate) return dayName(0);
  const n = dayNumber(date, dayOne);
  return n >= 1 ? dayName(n) : 'Pre-release';
}

export function dayWiseTable(boxoffice: BfStoredDay[], dayOne: string | null, premiereDate?: string | null): TTTable | null {
  if (boxoffice.length === 0) return null;
  const headers = ['Day', 'Date', 'Weekday', ...METRIC_HEADERS];
  const rows: TTTableRow[] = boxoffice.map((d) => ({
    Day: dayLabelFor(d.date, dayOne, premiereDate),
    Date: formatDate(d.date),
    Weekday: weekday(d.date),
    ...metricCells(d.totals)
  }));
  const total: BfFigures = { gross: 0, sold: 0, shows: 0, totalSeats: 0, fastfilling: 0, housefull: 0, occupancy: 0 };
  for (const d of boxoffice) {
    total.gross += n(d.totals.gross);
    total.sold += n(d.totals.sold);
    total.shows += n(d.totals.shows);
    total.totalSeats += n(d.totals.totalSeats);
  }
  const totalRow: TTTableRow = { Day: 'TOTAL', Date: '', Weekday: '', ...metricCells(total) };
  totalRow.__isTotal = true;
  rows.push(totalRow);
  return { label: 'Day-wise Collection', headers, rows };
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

// The "Day N" report heading for one box-office date, or null when the
// date has no real day number (release unknown, or stray pre-release
// shows before Day 0) -- those stay in the day-wise table only.
export function dayHeading(
  row: Pick<BfMovieRow, 'first_date' | 'release_date' | 'carried_over' | 'premiere_date'>,
  date: string
): string | null {
  const first = dayOneDate(row);
  if (!first) return null;
  if (row.premiere_date && date === row.premiere_date) return 'Day 0';
  const dn = dayNumber(date, first);
  return dn >= 1 ? `Day ${dn}` : null;
}

// The breakdown tables for one box-office day, labelled exactly as
// detailsFromData labels them (so they group under the same heading).
export function dayBreakdownTables(row: BfMovieRow, day: BfStoredDay): TTTable[] {
  const heading = dayHeading(row, day.date);
  if (!heading || !day.breakdown) return [];
  return breakdownTables((c) => `${c} — ${heading}`, day.breakdown);
}

export function detailsFromData(
  row: BfMovieRow,
  days: BfStoredDay[],
  cumulative: BfCumulative | null,
  today: string,
  fetchedAt: string = new Date().toISOString()
): TTMovieDetails {
  const state = movieState(row, today);
  const boxoffice = days.filter((d) => d.kind === 'boxoffice').sort((a, b) => a.date.localeCompare(b.date));
  const advance = days.filter((d) => d.kind === 'advance').sort((a, b) => a.date.localeCompare(b.date));
  const released = !!row.first_date || boxoffice.length > 0;
  const first = dayOneDate(row); // null for films released before the archive starts

  const tables: TTTable[] = [];
  const lazyDays: TTLazyDay[] = [];
  if (released) {
    const dw = dayWiseTable(boxoffice, first, row.premiere_date);
    if (dw) tables.push(dw);
    // Per-day breakdowns only where a real Day number exists (premiere day
    // included as "Day 0"); stray pre-release shows stay in the day-wise
    // table and totals but get no report of their own.
    for (const d of boxoffice) {
      const heading = dayHeading(row, d.date);
      if (!heading) continue;
      if (d.breakdown) tables.push(...breakdownTables((c) => `${c} — ${heading}`, d.breakdown));
      else lazyDays.push({ heading, date: d.date });
    }
    if (cumulative) tables.push(...breakdownTables((c) => `Cumulative ${c}`, cumulative));
  }
  for (const d of advance) {
    if (!d.breakdown) continue;
    tables.push(...breakdownTables((c) => `Advance ${d.date} — ${c}`, d.breakdown));
  }

  // Stats: fixed labels so the compare feature can line movies up by label.
  const stats: TTStat[] = [];
  const totalGross = n(row.total_gross);
  const totalSold = n(row.total_sold);
  const totalSeats = n(row.total_seats);
  const dayNote = (date: string) => (first ? dayLabelFor(date, first, row.premiere_date) || null : formatDate(date));
  if (released) {
    stats.push({ label: row.carried_over ? SINCE_ARCHIVE : 'Tracked Gross', value: formatMoney(totalGross), note: null });
    if (row.latest?.date) {
      stats.push({
        label: row.latest.date === today ? "Today's Gross" : 'Latest Day',
        value: formatMoney(n(row.latest.gross)),
        note: dayNote(row.latest.date)
      });
    }
    if (row.best?.date) stats.push({ label: 'Best Day', value: formatMoney(n(row.best.gross)), note: dayNote(row.best.date) });
    stats.push({ label: 'Tickets Sold', value: formatCount(totalSold), note: null });
    stats.push({ label: 'Shows', value: formatCount(n(row.total_shows)), note: null });
    if (totalSeats > 0) stats.push({ label: 'Avg Occupancy', value: formatPct((totalSold / totalSeats) * 100), note: null });
  }
  if (row.advance?.date && row.advance_date && row.advance_date >= today) {
    stats.push({ label: 'Advance Gross', value: formatMoney(n(row.advance.gross)), note: formatDate(row.advance.date) });
    stats.push({ label: 'Advance Tickets', value: formatCount(n(row.advance.sold)), note: formatDate(row.advance.date) });
  }

  const meta: TTMovieMetaItem[] = [];
  if (row.carried_over) meta.push({ label: 'Released', value: 'Before 1 Jan 2025 (figures shown are from 1 Jan 2025)', wide: true });
  else if (row.release_date) meta.push({ label: released ? 'Released On' : 'Releasing On', value: formatDate(row.release_date), wide: false });
  if (row.languages?.length) meta.push({ label: 'Languages', value: row.languages.join(', '), wide: false });
  if (row.formats?.length) meta.push({ label: 'Formats', value: row.formats.join(', '), wide: true });

  const dayN = first && row.last_date ? dayNumber(row.last_date, first) : null;
  const daysWithShows = n(row.days_tracked);
  const headlineGross = released ? formatMoney(totalGross) : row.advance ? formatMoney(n(row.advance.gross)) : null;
  const headlineLabel = released
    ? row.carried_over
      ? `${SINCE_ARCHIVE} · released earlier`
      : state === 'live'
        ? `Tracked Gross · Day ${dayN} running`
        : `Tracked Gross · Final · ${daysWithShows} days with shows`
    : row.advance?.date
      ? `Advance Gross · ${formatDate(row.advance.date)}`
      : null;
  const badgeText =
    state === 'live'
      ? dayN != null
        ? `Live Tracking · Day ${dayN}`
        : 'Live Tracking'
      : state === 'advance'
        ? 'Advance Booking'
        : state === 'final'
          ? 'Final'
          : null;

  return {
    slug: row.slug,
    title: row.title,
    url: `/movie/${row.slug}`,
    state,
    poster: row.poster,
    badgeText,
    headlineGross,
    headlineLabel,
    stats,
    meta,
    metaUpdatedText: row.source_updated ? `Last updated ${row.source_updated}` : null,
    tables,
    ...(lazyDays.length ? { lazyDays } : {}),
    fetchedAt
  };
}

// ---------------------------------------------------------------------------
// Generic text helpers (moved here from the TrackTollywood scraper so pages
// can drop that dependency)
// ---------------------------------------------------------------------------

// "₹5.41 Cr" -> 5.41, "₹42.40 L" -> 0.424 (always crores); null otherwise.
export function parseAmountToCr(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '');
  const crMatch = cleaned.match(/([\d.]+)\s*Cr/i);
  if (crMatch) {
    const v = Number(crMatch[1]);
    return Number.isFinite(v) ? v : null;
  }
  const lMatch = cleaned.match(/([\d.]+)\s*L/i);
  if (lMatch) {
    const v = Number(lMatch[1]);
    return Number.isFinite(v) ? v / 100 : null;
  }
  return null;
}

// "Releasing 25 Sep 2026" / "Released 18 Sep 2026" / "25 Sep 2026" -> Date.
export function parseReleaseDate(releaseText: string | null): Date | null {
  if (!releaseText) return null;
  const m = releaseText.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return null;
  const d = new Date(`${m[2]} ${m[1]}, ${m[3]}`);
  return Number.isNaN(d.getTime()) ? null : d;
}
