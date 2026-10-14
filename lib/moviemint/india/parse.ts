// MovieMint India movie pages -> plain data. Pure (no I/O), unit-tested.
//
// moviemintbo.com/movie/<id> is a public page (robots.txt allows everything
// except /api/ and /admin/, which Fyre never requests). Its server response
// embeds the page's own data in the Next.js Flight payload, so one ordinary
// page request gives:
//   - the movie's config (title, language, release date, poster, note)
//   - dailySeries: every tracked day's India totals (gross, tickets, shows,
//     seats, occupancy, last-updated time) for the whole run
//   - for ONE selected date (?date=YYYYMMDD; default = today): the day's
//     summary and its India breakdowns -- states (with cities), languages,
//     formats, trade territories
// ?kind=advance gives the same day block for an advance (pre-sales) date.
//
// MovieMint publishes these as BookMyShow-tracked estimates. Fyre keeps
// MovieMint's own definitions: "gross" is MovieMint's tracked gross (no
// net/share conversion), tickets are tickets sold, occupancy is MovieMint's
// tickets / seats. Nothing here invents a figure MovieMint did not give:
// absent lists stay empty and are reported as unavailable downstream.
import { flightText } from '../catalog';

export type MmiKind = 'boxoffice' | 'advance';

export type MmiSeriesPoint = {
  date: string; // YYYY-MM-DD (show date, IST)
  gross: number;
  sold: number;
  shows: number;
  seats: number | null;
  occupancy: number | null; // MovieMint's avgOccupancy, percent
  lastUpdated: string | null; // e.g. "2026-09-24 23:41 IST"
};

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

export type MmiCity = MmiFigures & { name: string; state: string | null };
export type MmiNamed = MmiFigures & { name: string };

export type MmiDay = {
  date: string; // YYYY-MM-DD
  lastUpdated: string | null;
  source: string | null; // MovieMint's stated underlying source, e.g. "BookMyShow"
  summary: MmiFigures & { cities: number; states: number };
  states: MmiNamed[];
  cities: MmiCity[];
  languages: MmiNamed[];
  formats: MmiNamed[];
  territories: (MmiNamed & { subRegion: boolean })[];
  // Lists MovieMint shows on its page but leaves empty in its data -- kept
  // so the importer can report them as unavailable, never filled in.
  chainsAvailable: boolean;
  theatersAvailable: boolean;
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
  kind: MmiKind;
  todayDate: string | null;
  availableDates: string[]; // dates MovieMint offers a page for (YYYY-MM-DD)
  completedMode: boolean | null;
  series: MmiSeriesPoint[]; // box-office pages only
  day: MmiDay | null;
};

export class MmiFormatError extends Error {}

const ymd = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
};

const str = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && s !== '$undefined' && s.toLowerCase() !== 'unknown' ? s : null;
};

const num = (v: unknown): number | null => {
  if (v == null || v === '$undefined' || v === '') return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};

const money = (v: unknown): number => Math.round((num(v) ?? 0) * 100) / 100;
const count = (v: unknown): number => Math.round(num(v) ?? 0);

// Reads the JSON value that follows `"key":` at or after `from`, by
// bracket matching (strings respected). null when the key is absent.
export function jsonAt(text: string, key: string, from = 0): { value: any; end: number } | null {
  const needle = `"${key}":`;
  const i = text.indexOf(needle, from);
  if (i < 0) return null;
  let s = i + needle.length;
  while (text[s] === ' ') s++;
  const open = text[s];
  if (open === '{' || open === '[') {
    const close = open === '{' ? '}' : ']';
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
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) {
          try {
            return { value: JSON.parse(text.slice(s, k + 1)), end: k + 1 };
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  }
  const m = /^("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|true|false|null)/i.exec(text.slice(s));
  if (!m) return null;
  try {
    return { value: JSON.parse(m[1]), end: s + m[1].length };
  } catch {
    return null;
  }
}

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

export function parseDay(text: string, from: number, fallbackDate: string | null): MmiDay | null {
  const meta = jsonAt(text, 'metadata', from);
  if (!meta) return null;
  const at = meta.end;
  const summary = jsonAt(text, 'summary', at)?.value;
  if (!summary || typeof summary !== 'object') return null;
  const listAt = (k: string) => {
    const r = jsonAt(text, k, at);
    return Array.isArray(r?.value) ? (r!.value as any[]) : null;
  };
  const rawStates = listAt('indiaStates') ?? [];
  const states: MmiNamed[] = [];
  const cities: MmiCity[] = [];
  for (const s of rawStates) {
    const name = str(s?.name);
    if (!name) continue;
    states.push({ name, ...figures(s, ROW_KEYS) });
    for (const c of Array.isArray(s?.cities) ? s.cities : []) {
      const cn = str(c?.name);
      if (!cn) continue;
      cities.push({ name: cn, state: str(c?.state) ?? name, ...figures(c, ROW_KEYS) });
    }
  }
  cities.sort((a, b) => b.gross - a.gross || b.sold - a.sold || a.name.localeCompare(b.name));
  states.sort((a, b) => b.gross - a.gross || b.sold - a.sold || a.name.localeCompare(b.name));
  // Language / format rows carry gross, shows, tickets and occupancy -- no
  // seat or venue counts, so those stay null (never back-computed).
  const LANG_KEYS = { gross: 'gross', sold: 'ticketsSold', shows: 'shows', occupancy: 'occupancy' };
  const languages = (listAt('indiaLanguages') ?? [])
    .map((l) => ({ name: str(l?.language) ?? str(l?.name), ...figures(l, LANG_KEYS) }))
    .filter((l): l is MmiNamed => !!l.name)
    .sort((a, b) => b.gross - a.gross);
  const formats = (listAt('indiaFormats') ?? [])
    .map((f) => ({ name: str(f?.format) ?? str(f?.name), ...figures(f, LANG_KEYS) }))
    .filter((f): f is MmiNamed => !!f.name)
    .sort((a, b) => b.gross - a.gross);
  const territories = (listAt('indiaTerritories') ?? [])
    .map((t) => ({ name: str(t?.name), subRegion: t?.subRegion === true, ...figures(t, ROW_KEYS) }))
    .filter((t): t is MmiNamed & { subRegion: boolean } => !!t.name);
  const chains = listAt('chainBreakdown');
  const theaters = listAt('topTheaters');
  const date = ymd(jsonAt(text, 'date', from)?.value) ?? fallbackDate;
  if (!date) return null;
  return {
    date,
    lastUpdated: str(meta.value?.lastUpdated),
    source: str(meta.value?.source),
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
    states,
    cities,
    languages,
    formats,
    territories,
    chainsAvailable: !!chains && chains.length > 0,
    theatersAvailable: !!theaters && theaters.length > 0
  };
}

// `html` is the full page response. Throws MmiFormatError when the page
// does not look like a MovieMint movie page (a structure change must never
// be mistaken for "no data").
export function parseMoviePage(html: string, requestedId: string, kind: MmiKind): MmiPage {
  const text = flightText(html);
  const cfgAt = text.indexOf('"config":{"movieId":');
  if (cfgAt < 0) throw new MmiFormatError(`MovieMint page for ${requestedId}: no movie config found`);
  const config = jsonAt(text, 'config', cfgAt)?.value;
  const movieId = str(config?.movieId);
  if (!movieId) throw new MmiFormatError(`MovieMint page for ${requestedId}: unreadable movie config`);
  if (movieId !== requestedId) throw new MmiFormatError(`MovieMint page for ${requestedId} describes ${movieId}`);
  if (config?.region && config.region !== 'india') throw new MmiFormatError(`MovieMint page for ${requestedId} is region ${config.region}`);

  const afterCfg = cfgAt;
  const available = jsonAt(text, 'availableDates', afterCfg)?.value;
  const availableDates = (Array.isArray(available) ? available : []).map(ymd).filter((d): d is string => !!d).sort();
  const selected = ymd(jsonAt(text, 'selectedDate', afterCfg)?.value);
  const today = ymd(jsonAt(text, 'todayDate', afterCfg)?.value);
  const completed = jsonAt(text, 'completedMode', afterCfg)?.value;

  let series: MmiSeriesPoint[] = [];
  if (kind === 'boxoffice') {
    const raw = jsonAt(text, 'dailySeries', afterCfg)?.value;
    if (!Array.isArray(raw)) throw new MmiFormatError(`MovieMint page for ${requestedId}: no daily series`);
    const byDate = new Map<string, MmiSeriesPoint>();
    for (const p of raw) {
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

  const day = parseDay(text, afterCfg, selected);
  return {
    movieId,
    title: str(config?.title),
    language: str(config?.language),
    releaseDate: ymd(config?.releaseDate),
    poster: str(config?.poster),
    badge: str(config?.badge),
    note: str(config?.note),
    region: str(config?.region),
    kind,
    todayDate: today,
    availableDates,
    completedMode: typeof completed === 'boolean' ? completed : null,
    series,
    day
  };
}

// moviemintbo.com/advance: every movie with advance sales open (upcoming
// releases and running films' next days). Identity only.
export type MmiAdvanceListing = { id: string; title: string; language: string | null; releaseDate: string | null; poster: string | null; badge: string | null };

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
    out.set(id, { id, title, language: str(c.value?.language), releaseDate: ymd(c.value?.releaseDate), poster: str(c.value?.poster), badge: str(c.value?.badge) });
  }
  return [...out.values()];
}
