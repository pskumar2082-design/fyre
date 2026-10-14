// MovieMint India pages -> plain data. Pure (no I/O), unit-tested.
//
// moviemintbo.com/movie/<id> is a public page (robots.txt allows everything
// except /api/ and /admin/, which Fyre never requests). The server response
// embeds the page's own props in the Next.js Flight payload:
//   { data: { config, region, date, metadata, summary, indiaStates,
//             indiaLanguages, indiaFormats, indiaTerritories, ...legacy lists },
//     availableDates, selectedDate, selectedDates, releaseDate, dailySeries,
//     todayDate, completedMode, completedAsOf, advanceHref | trackedHref, race }
// One request gives the movie's config, its whole tracked-window day series
// and ONE selected report:
//   default             today's live snapshot
//   ?date=YYYYMMDD      one day (also days after the tracked window)
//   ?date=cumulative    the whole tracked window ("Cumulative - All Days")
//   ?kind=advance[&date] one advance show date
// A date MovieMint does not have silently returns ANOTHER date's page, so
// callers always compare the returned date with the requested one.
//
// MovieMint publishes BookMyShow-tracked online-sales estimates. Fyre keeps
// MovieMint's own definitions and numbers: nothing here estimates a figure
// MovieMint did not give; absent values stay null.
import { flightText } from '../catalog';

export type MmiKind = 'boxoffice' | 'advance';

export type MmiSeriesPoint = {
  date: string; // YYYY-MM-DD (show date, IST)
  gross: number; // INR, MovieMint's precision (paise)
  sold: number;
  shows: number;
  seats: number | null; // absent on the live-day point
  occupancy: number | null; // MovieMint's avgOccupancy, percent (1 dp)
  lastUpdated: string | null; // "2026-09-24 23:41 IST"
};

// Figures as MovieMint published them. `occupancy` here is ALWAYS
// MovieMint's own figure; Fyre's recomputed tickets / seats lives elsewhere.
export type MmiFigures = {
  gross: number;
  sold: number;
  shows: number;
  seats: number | null;
  occupancy: number | null;
  ff: number | null;
  hf: number | null;
  venues: number | null;
};

export type MmiCityFormat = { name: string; gross: number };
export type MmiCity = MmiFigures & {
  name: string;
  state: string | null;
  tradeRegion: string | null; // Andhra Pradesh / Telangana only
  tradeDistrict: string | null;
  formats: MmiCityFormat[]; // gross only (MovieMint gives no tickets/shows per city format)
};
export type MmiNamed = MmiFigures & { name: string; cities: number | null };
export type MmiTerritory = MmiNamed & { subRegion: boolean };

export type MmiDay = {
  date: string; // YYYY-MM-DD, or 'cumulative' for the whole-window report
  lastUpdated: string | null;
  source: string | null; // MovieMint's stated underlying source, e.g. "BookMyShow"
  summary: MmiFigures & { cities: number; states: number };
  summaryRaw: Record<string, number | null>; // the summary object exactly as published
  states: MmiNamed[];
  cities: MmiCity[];
  languages: MmiNamed[];
  formats: MmiNamed[];
  territories: MmiTerritory[];
  // Lists MovieMint carries but leaves empty (chains, top theatres, legacy
  // breakdowns). Reported if they ever start carrying data; never filled in.
  populatedLegacyLists: string[];
  chainsAvailable: boolean;
  theatersAvailable: boolean;
};

export type MmiMeta = {
  backdrop: string | null;
  genres: string[];
  tmdbId: number | null;
  searchName: string | null;
  trackedFloorExempt: unknown;
  hideTrackedSwitch: unknown;
};

export type MmiPage = {
  movieId: string;
  title: string | null;
  language: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  poster: string | null;
  badge: string | null;
  note: string | null;
  region: string | null;
  meta: MmiMeta;
  kind: MmiKind;
  requested: string | null; // the date asked for (YYYY-MM-DD | 'cumulative' | null = default)
  todayDate: string | null;
  availableDates: string[]; // tracked-window dates (box office) or open show dates (advance)
  selectedDates: string[];
  completedMode: boolean | null; // live day: figures count completed shows only
  completedAsOf: string | null; // "20:40 IST"
  series: MmiSeriesPoint[]; // box-office pages only (tracked window)
  day: MmiDay | null;
  // Fields this parser does not know (MovieMint added something): reported,
  // never silently dropped.
  unknown: string[];
};

export class MmiFormatError extends Error {}
// The page answered with a different date than the one requested.
export class MmiDateMismatch extends Error {
  constructor(
    public requested: string,
    public returned: string | null
  ) {
    super(`MovieMint returned ${returned ?? 'no date'} for ${requested}`);
  }
}

export const CUMULATIVE = 'cumulative';

const ymd = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
};

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && !s.startsWith('$') && s.toLowerCase() !== 'unknown' ? s : null;
};

const num = (v: unknown): number | null => {
  if (v == null || v === '' || (typeof v === 'string' && v.startsWith('$'))) return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};

// Money keeps MovieMint's paise; float noise (371047557.70000005) is cut at 2 dp.
const money = (v: unknown): number => Math.round((num(v) ?? 0) * 100) / 100;
const count = (v: unknown): number => Math.round(num(v) ?? 0);

// ---------------------------------------------------------------------------
// Flight helpers
// ---------------------------------------------------------------------------

function endOfValue(text: string, s: number): number {
  const open = text[s];
  if (open !== '{' && open !== '[') return -1;
  let depth = 0;
  let inStr = false;
  for (let k = s; k < text.length; k++) {
    const c = text[k];
    if (inStr) {
      if (c === '\\') k++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return k;
    }
  }
  return -1;
}

// Reads the JSON value that follows `"key":` at or after `from`.
export function jsonAt(text: string, key: string, from = 0): { value: any; end: number } | null {
  const needle = `"${key}":`;
  const i = text.indexOf(needle, from);
  if (i < 0) return null;
  let s = i + needle.length;
  while (text[s] === ' ') s++;
  if (text[s] === '{' || text[s] === '[') {
    const e = endOfValue(text, s);
    if (e < 0) return null;
    try {
      return { value: JSON.parse(text.slice(s, e + 1)), end: e + 1 };
    } catch {
      return null;
    }
  }
  const m = /^("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|true|false|null)/i.exec(text.slice(s));
  if (!m) return null;
  try {
    return { value: JSON.parse(m[1]), end: s + m[1].length };
  } catch {
    return null;
  }
}

// The page's props object: the `{...}` holding `"data":{"config":...}`.
// Flight wraps React props as ["$","$L11",null,{...}], so the props start
// right after the nearest `null,` whose object encloses the data key.
export function pageProps(text: string): any | null {
  const at = text.indexOf('"data":{"config":{"movieId"');
  if (at < 0) return null;
  for (let j = text.lastIndexOf('null,{', at); j >= 0; j = text.lastIndexOf('null,{', j - 1)) {
    const s = j + 5;
    const e = endOfValue(text, s);
    if (e > at) {
      try {
        return JSON.parse(text.slice(s, e + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Known fields (the unknown-field detector compares against these)
// ---------------------------------------------------------------------------

export const KNOWN = {
  props: ['race', 'data', 'availableDates', 'selectedDate', 'selectedDates', 'releaseDate', 'dailySeries', 'todayDate', 'completedMode', 'completedAsOf', 'advanceHref', 'trackedHref'],
  data: ['config', 'region', 'date', 'metadata', 'summary', 'stateBreakdown', 'languageBreakdown', 'formatBreakdown', 'chainBreakdown', 'topTheaters', 'indiaStates', 'indiaLanguages', 'indiaFormats', 'indiaTerritories'],
  config: ['movieId', 'title', 'tmdbId', 'poster', 'backdrop', 'releaseDate', 'language', 'genres', 'region', 'searchName', 'hideTrackedSwitch', 'trackedFloorExempt', 'badge', 'note'],
  series: ['date', 'gross', 'ticketsSold', 'shows', 'avgOccupancy', 'lastUpdated', 'totalSeats'],
  metadata: ['lastUpdated', 'source'],
  summary: ['totalGross', 'totalShows', 'totalTicketsSold', 'totalSeats', 'totalLocations', 'avgOccupancy', 'totalFastFilling', 'totalHouseFull'],
  state: ['name', 'gross', 'ticketsSold', 'totalSeats', 'occupancy', 'shows', 'venues', 'fastFilling', 'houseFull', 'cities'],
  city: ['name', 'state', 'gross', 'shows', 'ticketsSold', 'totalSeats', 'occupancy', 'venues', 'formats', 'fastFilling', 'houseFull', 'tradeRegion', 'tradeDistrict'],
  cityFormat: ['name', 'gross'],
  language: ['language', 'gross', 'shows', 'ticketsSold', 'cities', 'occupancy'],
  format: ['format', 'gross', 'shows', 'ticketsSold', 'cities', 'occupancy'],
  territory: ['name', 'subRegion', 'gross', 'shows', 'ticketsSold', 'totalSeats', 'venues', 'occupancy', 'fastFilling', 'houseFull']
} as const;

const LEGACY_LISTS = ['stateBreakdown', 'languageBreakdown', 'formatBreakdown', 'chainBreakdown', 'topTheaters'] as const;

function collectUnknown(where: string, objs: unknown[], known: readonly string[], out: Set<string>) {
  for (const o of objs) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
    for (const k of Object.keys(o)) if (!known.includes(k)) out.add(`${where}.${k}`);
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function figures(o: any, keys: { gross: string; sold: string; shows: string; seats?: string; occupancy?: string; ff?: string; hf?: string; venues?: string }): MmiFigures {
  return {
    gross: money(o?.[keys.gross]),
    sold: count(o?.[keys.sold]),
    shows: count(o?.[keys.shows]),
    seats: keys.seats ? num(o?.[keys.seats]) : null,
    occupancy: keys.occupancy ? num(o?.[keys.occupancy]) : null,
    ff: keys.ff ? num(o?.[keys.ff]) : null,
    hf: keys.hf ? num(o?.[keys.hf]) : null,
    venues: keys.venues ? num(o?.[keys.venues]) : null
  };
}

const ROW_KEYS = { gross: 'gross', sold: 'ticketsSold', shows: 'shows', seats: 'totalSeats', occupancy: 'occupancy', ff: 'fastFilling', hf: 'houseFull', venues: 'venues' };
const LIST_KEYS = { gross: 'gross', sold: 'ticketsSold', shows: 'shows', occupancy: 'occupancy' };
const byGross = <T extends { gross: number; sold: number; name: string }>(a: T, b: T) => b.gross - a.gross || b.sold - a.sold || a.name.localeCompare(b.name);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export function parseDayBlock(data: any, fallbackDate: string | null, unknown: Set<string>): MmiDay | null {
  const summary = data?.summary;
  if (!summary || typeof summary !== 'object') return null;
  const rawStates = arr(data.indiaStates);
  collectUnknown('summary', [summary], KNOWN.summary, unknown);
  collectUnknown('metadata', [data.metadata], KNOWN.metadata, unknown);
  collectUnknown('state', rawStates, KNOWN.state, unknown);
  const states: MmiNamed[] = [];
  const cities: MmiCity[] = [];
  for (const s of rawStates) {
    const name = str(s?.name);
    if (!name) continue;
    states.push({ name, cities: Array.isArray(s?.cities) ? s.cities.length : null, ...figures(s, ROW_KEYS) });
    collectUnknown('city', arr(s?.cities), KNOWN.city, unknown);
    for (const c of arr(s?.cities)) {
      const cn = str(c?.name);
      if (!cn) continue;
      collectUnknown('city.format', arr(c?.formats), KNOWN.cityFormat, unknown);
      cities.push({
        name: cn,
        state: str(c?.state) ?? name,
        tradeRegion: str(c?.tradeRegion),
        tradeDistrict: str(c?.tradeDistrict),
        formats: arr(c?.formats)
          .map((f) => ({ name: str(f?.name) ?? '', gross: money(f?.gross) }))
          .filter((f) => f.name),
        ...figures(c, ROW_KEYS)
      });
    }
  }
  cities.sort(byGross);
  states.sort(byGross);
  const named = (list: any[], nameKey: 'language' | 'format', where: 'language' | 'format') => {
    collectUnknown(where, list, KNOWN[where], unknown);
    return list
      .map((l) => ({ name: str(l?.[nameKey]) ?? str(l?.name) ?? '', cities: num(l?.cities), ...figures(l, LIST_KEYS) }))
      .filter((l) => l.name)
      .sort(byGross);
  };
  const territoriesRaw = arr(data.indiaTerritories);
  collectUnknown('territory', territoriesRaw, KNOWN.territory, unknown);
  const territories: MmiTerritory[] = territoriesRaw
    .map((t) => ({ name: str(t?.name) ?? '', subRegion: t?.subRegion === true, cities: null, ...figures(t, ROW_KEYS) }))
    .filter((t) => t.name);
  const populated = LEGACY_LISTS.filter((k) => arr(data[k]).length > 0);
  const raw: Record<string, number | null> = {};
  for (const k of Object.keys(summary)) raw[k] = num(summary[k]);
  const dateRaw = typeof data.date === 'string' ? data.date : null;
  const date = dateRaw === CUMULATIVE ? CUMULATIVE : (ymd(dateRaw) ?? fallbackDate);
  if (!date) return null;
  return {
    date,
    lastUpdated: str(data.metadata?.lastUpdated),
    source: str(data.metadata?.source),
    summary: {
      ...figures(summary, {
        gross: 'totalGross',
        sold: 'totalTicketsSold',
        shows: 'totalShows',
        seats: 'totalSeats',
        occupancy: 'avgOccupancy',
        ff: 'totalFastFilling',
        hf: 'totalHouseFull',
        venues: 'totalLocations'
      }),
      cities: new Set(cities.map((c) => `${c.name}|${c.state}`)).size,
      states: states.length
    },
    summaryRaw: raw,
    states,
    cities,
    languages: named(arr(data.indiaLanguages), 'language', 'language'),
    formats: named(arr(data.indiaFormats), 'format', 'format'),
    territories,
    populatedLegacyLists: [...populated],
    chainsAvailable: arr(data.chainBreakdown).length > 0,
    theatersAvailable: arr(data.topTheaters).length > 0
  };
}

// `html` is the full page response. `requested` = the date asked for
// (YYYY-MM-DD or 'cumulative'); when given, a page for any other date throws
// MmiDateMismatch -- the caller records the date as missing, never stores it.
// Throws MmiFormatError when the page is not a MovieMint movie page.
export function parseMoviePage(html: string, requestedId: string, kind: MmiKind, requested: string | null = null): MmiPage {
  const text = flightText(html);
  const props = pageProps(text);
  if (!props || typeof props.data !== 'object') {
    if (/Movie Not Found|could not be found|Snapshot unavailable/i.test(text) && requested) throw new MmiDateMismatch(requested, null);
    throw new MmiFormatError(`MovieMint page for ${requestedId}: no movie config found`);
  }
  const data = props.data;
  const config = data.config ?? {};
  const movieId = str(config.movieId);
  if (!movieId) throw new MmiFormatError(`MovieMint page for ${requestedId}: unreadable movie config`);
  if (movieId !== requestedId) throw new MmiFormatError(`MovieMint page for ${requestedId} describes ${movieId}`);
  if (config.region && config.region !== 'india') throw new MmiFormatError(`MovieMint page for ${requestedId} is region ${config.region}`);

  const unknown = new Set<string>();
  for (const k of Object.keys(props)) if (!KNOWN.props.includes(k as never)) unknown.add(`page.${k}`);
  for (const k of Object.keys(data)) if (!KNOWN.data.includes(k as never)) unknown.add(`data.${k}`);
  collectUnknown('config', [config], KNOWN.config, unknown);

  const availableDates = arr(props.availableDates)
    .map(ymd)
    .filter((d): d is string => !!d)
    .sort();
  const sel = props.selectedDates;
  const selectedDates = Array.isArray(sel) ? sel.map(ymd).filter((d): d is string => !!d) : typeof sel === 'string' && sel.endsWith(':availableDates') ? availableDates : [];

  let series: MmiSeriesPoint[] = [];
  if (kind === 'boxoffice') {
    // Release day before any show has finished: MovieMint serves its
    // day-one view (trackedHref set, no series yet). An empty series, not
    // a format change.
    const dayOneView = !('dailySeries' in props) && 'trackedHref' in props;
    if (!Array.isArray(props.dailySeries) && !dayOneView) throw new MmiFormatError(`MovieMint page for ${requestedId}: no daily series`);
    const rawSeries: any[] = Array.isArray(props.dailySeries) ? props.dailySeries : [];
    collectUnknown('series', rawSeries, KNOWN.series, unknown);
    const byDate = new Map<string, MmiSeriesPoint>();
    for (const p of rawSeries) {
      const date = ymd(p?.date);
      if (!date) continue;
      byDate.set(date, {
        date,
        gross: money(p.gross),
        sold: count(p.ticketsSold),
        shows: count(p.shows),
        seats: num(p.totalSeats),
        occupancy: num(p.avgOccupancy),
        lastUpdated: str(p.lastUpdated)
      });
    }
    series = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  const selectedDate = props.selectedDate === CUMULATIVE ? CUMULATIVE : ymd(props.selectedDate);
  const day = parseDayBlock(data, selectedDate, unknown);
  for (const k of day?.populatedLegacyLists ?? []) unknown.add(`data.${k} (now carries rows)`);

  if (requested) {
    const got = day?.date ?? null;
    if (got !== requested) throw new MmiDateMismatch(requested, got);
  }

  const tmdb = num(config.tmdbId);
  return {
    movieId,
    title: str(config.title),
    language: str(config.language),
    releaseDate: ymd(config.releaseDate) ?? ymd(props.releaseDate),
    poster: str(config.poster),
    badge: str(config.badge),
    note: str(config.note),
    region: str(config.region),
    meta: {
      backdrop: str(config.backdrop),
      genres: arr(config.genres).map(str).filter((g): g is string => !!g),
      tmdbId: tmdb && tmdb > 0 ? tmdb : null,
      searchName: str(config.searchName),
      trackedFloorExempt: typeof config.trackedFloorExempt === 'string' && config.trackedFloorExempt.startsWith('$') ? null : (config.trackedFloorExempt ?? null),
      hideTrackedSwitch: typeof config.hideTrackedSwitch === 'string' && config.hideTrackedSwitch.startsWith('$') ? null : (config.hideTrackedSwitch ?? null)
    },
    kind,
    requested,
    todayDate: ymd(props.todayDate),
    availableDates,
    selectedDates,
    completedMode: typeof props.completedMode === 'boolean' ? props.completedMode : null,
    completedAsOf: str(props.completedAsOf),
    series,
    day,
    unknown: [...unknown].sort()
  };
}

// ---------------------------------------------------------------------------
// Lists: /advance, /tracked, sitemap
// ---------------------------------------------------------------------------

// moviemintbo.com/advance: every movie with advance sales open (upcoming
// releases and running films' next days). Identity + the published entry.
export type MmiAdvanceListing = { id: string; title: string; language: string | null; releaseDate: string | null; poster: string | null; badge: string | null; entry?: Record<string, unknown> };

export function parseAdvanceList(html: string): MmiAdvanceListing[] {
  const text = flightText(html);
  const out = new Map<string, MmiAdvanceListing>();
  let i = 0;
  for (;;) {
    const at = text.indexOf('"config":{"movieId":', i);
    if (at < 0) break;
    const c = jsonAt(text, 'config', at);
    if (!c) break;
    i = c.end;
    const id = str(c.value?.movieId);
    const title = str(c.value?.title);
    if (!id || !title || out.has(id) || (c.value?.region && c.value.region !== 'india')) continue;
    // the rest of this listing: summary, topRegion, rank (stop at the next movie)
    const next = text.indexOf('"config":{"movieId":', c.end);
    const slice = text.slice(c.end, next < 0 ? undefined : next);
    const summary = jsonAt(slice, 'summary')?.value ?? null;
    const topRegion = jsonAt(slice, 'topRegion')?.value ?? null;
    const rank = jsonAt(slice, 'rank')?.value ?? null;
    out.set(id, {
      id,
      title,
      language: str(c.value?.language),
      releaseDate: ymd(c.value?.releaseDate),
      poster: str(c.value?.poster),
      badge: str(c.value?.badge),
      entry: { list: 'advance', config: c.value, summary, topRegion: str(topRegion), rank: num(rank) }
    });
  }
  return [...out.values()];
}

// moviemintbo.com/tracked: each entry exactly as published (identity plus
// MovieMint's tracked-window totals and top state). Keyed by boxOfficeId.
export function parseTrackedEntries(html: string): Map<string, Record<string, unknown>> {
  const text = flightText(html);
  const out = new Map<string, Record<string, unknown>>();
  for (const m of text.matchAll(/\{"boxOfficeId":"[^{}]*?\}/g)) {
    try {
      const o = JSON.parse(m[0]);
      const id = str(o.boxOfficeId);
      if (id && !out.has(id)) {
        for (const k of Object.keys(o)) if (typeof o[k] === 'string' && o[k].startsWith('$')) o[k] = null;
        out.set(id, { list: 'tracked', ...o });
      }
    } catch {
      // skip a malformed entry
    }
  }
  return out;
}

// moviemintbo.com/sitemap.xml: every movie MovieMint has a page for.
export function parseSitemapMovieIds(xml: string): string[] {
  const ids = new Set<string>();
  for (const m of xml.matchAll(/<loc>https?:\/\/[^<]*?\/movie\/([a-z0-9-]+)<\/loc>/gi)) ids.add(m[1]);
  return [...ids].sort();
}
