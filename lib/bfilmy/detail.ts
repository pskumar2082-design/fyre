// BFILMY's show-level files ("finaldetailed.json") -> fyre's permanent
// per-movie-day aggregates.
//
// BFILMY publishes one row per show (venue, time, seats, tickets sold,
// gross ...) next to the summary file lib/bfilmy/normalize.ts reads. Every
// table on BFILMY's own movie page (venue-wise, time slots, hourly
// momentum, ticket-price bands, PIC) is computed in the browser from these
// rows. This module does the same computation once, at import time, and
// keeps the results permanently -- so comparisons and posters for a film
// that released months ago never need the raw show rows again.
//
// Rules, each checked against BFILMY's own files and pages:
//   - Summing the show rows gives exactly the summary file's gross,
//     tickets, shows, seats and venues for every movie (29 Sep 2026: all
//     235 entries). The per-row "occupancy" field is always "0%" and is
//     ignored; occupancy is tickets / seats.
//   - Fast-filling = shows with 50% <= occupancy < 98%; housefull =
//     occupancy >= 98%. This reproduces the summary file's FF/HF counts
//     for all 235 entries.
//   - PIC = shows whose chain is exactly PVR, INOX or Cinepolis ("Cinepolis
//     P&A" is not included) -- reproduces BFILMY's PIC TOTAL row.
//   - Time slots and ticket-price bands use BFILMY's own labels.
import { canonicalTitle, parseEntryKey, slugify, titleKey } from './normalize';
import type { BfKind } from './types';

export type BfRawShow = {
  movie: string; // "The Paradise [2D | Telugu]"
  venue: string;
  venue_id?: string | number;
  chain?: string;
  time: string; // "09:35 AM"
  audi?: string;
  session_id?: string | number;
  totalSeats: number;
  available?: number;
  sold: number;
  gross: number;
  minsLeft?: number;
  city: string;
  state: string;
  occupancy?: string;
  s?: string;
};

export type BfRawDetailFile = { last_updated?: string; data: BfRawShow[] };

export const PIC_CHAINS = new Set(['PVR', 'INOX', 'Cinepolis']);
export const FF_MIN = 50;
export const HF_MIN = 98;

// Positional metric tuple used by every stored dimension row:
//   [key[], shows, seats, sold, gross, ff, hf, venues, cities]
// venues/cities are distinct counts within that row (null where the row
// is itself a single venue/city and the count would be meaningless).
export type DimRow = [(string | number)[], number, number, number, number, number, number, number | null, number | null];

// show_hour rows carry two extra positions: the distinct venues and cities
// with a show starting at or before this hour (BFILMY's "hourly trending"
// columns), which can't be derived by adding hours together.
export type HourRow = [...DimRow, number, number];

export const DETAIL_DIMENSIONS = ['venue', 'language', 'format', 'language_state', 'language_city', 'show_hour', 'price_band'] as const;
export type DetailDimension = (typeof DETAIL_DIMENSIONS)[number];

export type DetailSummary = {
  shows: number;
  seats: number;
  sold: number;
  gross: number;
  ff: number;
  hf: number;
  venues: number;
  cities: number;
  states: number;
  pic: { shows: number; seats: number; sold: number; gross: number; ff: number; hf: number; venues: number; cities: number };
  unparsedTimes: number;
};

// A show row as stored in bf_show (short-lived drilldown copy).
export type ShowRecord = {
  format: string;
  language: string;
  venueKey: string;
  venueName: string;
  city: string;
  state: string;
  chain: string;
  time: string;
  hour: number | null;
  audi: string;
  sessionId: string;
  seats: number;
  available: number | null;
  sold: number;
  gross: number;
  sourceFlag: string | null;
  sourceVenueId: string | null;
};

export type VenueRef = { key: string; name: string; city: string; state: string; chain: string };

export type BfDetailMovieDay = {
  key: string; // same grouping identity as the summary (titleKey of canonical title)
  title: string;
  kind: BfKind;
  date: string;
  languages: string[];
  summary: DetailSummary;
  dims: Record<Exclude<DetailDimension, 'show_hour'>, DimRow[]> & { show_hour: HourRow[] };
  shows: ShowRecord[];
  venues: VenueRef[];
};

// BFILMY's time-slot labels, by show start hour (0-23).
export const TIME_SLOTS: { label: string; hours: number[] }[] = [
  { label: 'Early Morning (4AM - 8AM)', hours: [4, 5, 6, 7] },
  { label: 'Morning (8AM - 12PM)', hours: [8, 9, 10, 11] },
  { label: 'Noon (12PM - 3PM)', hours: [12, 13, 14] },
  { label: 'Evening (3PM - 7PM)', hours: [15, 16, 17, 18] },
  { label: 'Night (7PM - 10PM)', hours: [19, 20, 21] },
  // Shows after midnight belong to the same show date's late-night block.
  { label: 'Late Night (10PM onwards)', hours: [22, 23, 0, 1, 2, 3] }
];

// Order in which hours happen within one show date (after-midnight shows last).
export function hourOrder(hour: number): number {
  return hour < 4 ? hour + 24 : hour;
}

// BFILMY's ticket-price bands, by the show's average ticket price. A show
// that sold no tickets has no price, so it goes in its own band rather
// than being guessed into one.
export const PRICE_BANDS: { label: string; max: number }[] = [
  { label: '₹100 or Below', max: 100 },
  { label: '₹100 - ₹199', max: 200 },
  { label: '₹200 - ₹299', max: 300 },
  { label: '₹300 - ₹499', max: 500 },
  { label: '₹500 - ₹699', max: 700 },
  { label: '₹700 - ₹999', max: 1000 },
  { label: '₹1000 - ₹1499', max: 1500 },
  { label: '₹1500 - ₹1999', max: 2000 },
  { label: '₹2000+', max: Infinity }
];
export const NO_SALES_BAND = 'No tickets sold';

export function priceBand(gross: number, sold: number): string {
  if (!(sold > 0)) return NO_SALES_BAND;
  const atp = gross / sold;
  if (atp <= 100) return PRICE_BANDS[0].label;
  for (const b of PRICE_BANDS.slice(1)) if (atp < b.max) return b.label;
  return PRICE_BANDS[PRICE_BANDS.length - 1].label;
}

// "09:35 AM" -> 9, "12:10 AM" -> 0, "12:30 PM" -> 12; null if unreadable.
export function parseShowHour(time: string): number | null {
  const m = String(time ?? '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h < 1 || h > 12) return null;
  const pm = m[3].toUpperCase() === 'PM';
  return (h % 12) + (pm ? 12 : 0);
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function showOccupancy(sold: number, seats: number): number {
  return seats > 0 ? (sold / seats) * 100 : 0;
}

export function isFastFilling(sold: number, seats: number): boolean {
  const o = showOccupancy(sold, seats);
  return seats > 0 && o >= FF_MIN && o < HF_MIN;
}

export function isHousefull(sold: number, seats: number): boolean {
  return seats > 0 && showOccupancy(sold, seats) >= HF_MIN;
}

export function venueKeyOf(r: { venue: string; city: string; state: string }): string {
  return `${String(r.venue ?? '').trim()}|${String(r.city ?? '').trim()}|${String(r.state ?? '').trim()}`;
}

type Acc = { shows: number; seats: number; sold: number; gross: number; ff: number; hf: number; venues: Set<string>; cities: Set<string> };
const newAcc = (): Acc => ({ shows: 0, seats: 0, sold: 0, gross: 0, ff: 0, hf: 0, venues: new Set(), cities: new Set() });

function add(acc: Acc, s: ShowRecord) {
  acc.shows += 1;
  acc.seats += s.seats;
  acc.sold += s.sold;
  acc.gross += s.gross;
  if (isFastFilling(s.sold, s.seats)) acc.ff += 1;
  if (isHousefull(s.sold, s.seats)) acc.hf += 1;
  acc.venues.add(s.venueKey);
  acc.cities.add(`${s.city}|${s.state}`);
}

const money = (v: number) => Math.round(v * 100) / 100;

function toRow(key: (string | number)[], a: Acc, counts: { venues: boolean; cities: boolean }): DimRow {
  return [key, a.shows, a.seats, a.sold, money(a.gross), a.ff, a.hf, counts.venues ? a.venues.size : null, counts.cities ? a.cities.size : null];
}

function bucket(map: Map<string, { key: (string | number)[]; acc: Acc }>, key: (string | number)[]) {
  const k = JSON.stringify(key);
  let b = map.get(k);
  if (!b) map.set(k, (b = { key, acc: newAcc() }));
  return b.acc;
}

function rowsOf(map: Map<string, { key: (string | number)[]; acc: Acc }>, counts: { venues: boolean; cities: boolean }): DimRow[] {
  return [...map.values()]
    .map((b) => toRow(b.key, b.acc, counts))
    .sort((a, b) => b[4] - a[4] || b[3] - a[3] || String(a[0][0]).localeCompare(String(b[0][0])));
}

export function normalizeDetailFile(file: BfRawDetailFile, kind: BfKind, date: string, aliasMap: Map<string, string>): BfDetailMovieDay[] {
  type Group = { title: string; shows: ShowRecord[] };
  const groups = new Map<string, Group>();

  for (const raw of file?.data ?? []) {
    if (!raw || typeof raw !== 'object' || !raw.movie) continue;
    const parsed = parseEntryKey(raw.movie);
    const title = canonicalTitle(parsed.title, aliasMap);
    const gk = titleKey(title) || slugify(title);
    let g = groups.get(gk);
    if (!g) groups.set(gk, (g = { title, shows: [] }));
    const venueName = String(raw.venue ?? '').trim();
    const city = String(raw.city ?? '').trim() || 'Unknown';
    const state = String(raw.state ?? '').trim() || 'Unknown';
    g.shows.push({
      format: parsed.format,
      language: parsed.language,
      venueKey: venueKeyOf({ venue: venueName, city, state }),
      venueName,
      city,
      state,
      chain: String(raw.chain ?? '').trim(),
      time: String(raw.time ?? '').trim(),
      hour: parseShowHour(raw.time),
      audi: String(raw.audi ?? '').trim(),
      sessionId: String(raw.session_id ?? '').trim(),
      seats: num(raw.totalSeats),
      available: raw.available == null ? null : num(raw.available),
      sold: num(raw.sold),
      gross: num(raw.gross),
      sourceFlag: raw.s ? String(raw.s) : null,
      sourceVenueId: raw.venue_id == null ? null : String(raw.venue_id)
    });
  }

  const out: BfDetailMovieDay[] = [];
  for (const [gk, g] of groups) {
    const total = newAcc();
    const pic = newAcc();
    const states = new Set<string>();
    const venue = new Map<string, { key: (string | number)[]; acc: Acc }>();
    const language = new Map<string, { key: (string | number)[]; acc: Acc }>();
    const format = new Map<string, { key: (string | number)[]; acc: Acc }>();
    const langState = new Map<string, { key: (string | number)[]; acc: Acc }>();
    const langCity = new Map<string, { key: (string | number)[]; acc: Acc }>();
    const hour = new Map<string, { key: (string | number)[]; acc: Acc }>();
    const band = new Map<string, { key: (string | number)[]; acc: Acc }>();
    const venueRefs = new Map<string, VenueRef>();
    let unparsedTimes = 0;

    for (const s of g.shows) {
      add(total, s);
      states.add(s.state);
      if (PIC_CHAINS.has(s.chain)) add(pic, s);
      add(bucket(venue, [s.venueKey]), s);
      add(bucket(language, [s.language]), s);
      add(bucket(format, [s.format]), s);
      add(bucket(langState, [s.language, s.state]), s);
      add(bucket(langCity, [s.language, s.city, s.state]), s);
      if (s.hour == null) unparsedTimes += 1;
      else add(bucket(hour, [s.hour]), s);
      add(bucket(band, [priceBand(s.gross, s.sold)]), s);
      if (!venueRefs.has(s.venueKey)) venueRefs.set(s.venueKey, { key: s.venueKey, name: s.venueName, city: s.city, state: s.state, chain: s.chain });
    }

    // Hourly: rows in show-time order, each with the distinct venues and
    // cities that had a show starting at or before that hour.
    const hourEntries = [...hour.values()].sort((a, b) => hourOrder(a.key[0] as number) - hourOrder(b.key[0] as number));
    const cumVenues = new Set<string>();
    const cumCities = new Set<string>();
    const hourRows: HourRow[] = hourEntries.map((b) => {
      b.acc.venues.forEach((v) => cumVenues.add(v));
      b.acc.cities.forEach((c) => cumCities.add(c));
      return [...toRow(b.key, b.acc, { venues: true, cities: true }), cumVenues.size, cumCities.size] as HourRow;
    });

    const languages = [...language.keys()].map((k) => JSON.parse(k)[0] as string).sort();

    out.push({
      key: gk,
      title: g.title,
      kind,
      date,
      languages,
      summary: {
        shows: total.shows,
        seats: total.seats,
        sold: total.sold,
        gross: money(total.gross),
        ff: total.ff,
        hf: total.hf,
        venues: total.venues.size,
        cities: total.cities.size,
        states: states.size,
        pic: {
          shows: pic.shows,
          seats: pic.seats,
          sold: pic.sold,
          gross: money(pic.gross),
          ff: pic.ff,
          hf: pic.hf,
          venues: pic.venues.size,
          cities: pic.cities.size
        },
        unparsedTimes
      },
      dims: {
        venue: rowsOf(venue, { venues: false, cities: false }),
        language: rowsOf(language, { venues: true, cities: true }),
        format: rowsOf(format, { venues: true, cities: true }),
        language_state: rowsOf(langState, { venues: true, cities: true }),
        language_city: rowsOf(langCity, { venues: true, cities: false }),
        show_hour: hourRows,
        price_band: rowsOf(band, { venues: true, cities: true })
      },
      shows: g.shows,
      venues: [...venueRefs.values()]
    });
  }
  return out.sort((a, b) => b.summary.gross - a.summary.gross);
}

// Cross-check: the show rows must add up to the summary file's own
// per-movie totals. Returns the movies (by grouping key) that don't.
export function reconcile(
  detail: BfDetailMovieDay[],
  summaryTotals: Map<string, { gross: number; sold: number; shows: number; totalSeats: number }>
): { key: string; title: string; field: string; detail: number; summary: number }[] {
  const out: { key: string; title: string; field: string; detail: number; summary: number }[] = [];
  const seen = new Set<string>();
  for (const d of detail) {
    seen.add(d.key);
    const s = summaryTotals.get(d.key);
    if (!s) {
      out.push({ key: d.key, title: d.title, field: 'missing-in-summary', detail: d.summary.gross, summary: 0 });
      continue;
    }
    const checks: [string, number, number, number][] = [
      ['gross', d.summary.gross, s.gross, 1],
      ['sold', d.summary.sold, s.sold, 0],
      ['shows', d.summary.shows, s.shows, 0],
      ['seats', d.summary.seats, s.totalSeats, 0]
    ];
    for (const [field, a, b, tol] of checks) if (Math.abs(a - b) > tol) out.push({ key: d.key, title: d.title, field, detail: a, summary: b });
  }
  for (const [key, s] of summaryTotals) if (!seen.has(key) && s.shows > 0) out.push({ key, title: key, field: 'missing-in-detail', detail: 0, summary: s.gross });
  return out;
}
