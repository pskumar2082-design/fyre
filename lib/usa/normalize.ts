// BFILMY USA feed ("USA · Indian-language screenings") -> Fyre aggregates.
// Pure: no network, no database. See lib/usa/sync.ts for the import.
//
// Source files (plain JSON, no key): usadata<YYYY>.pages.dev/
//   usa-boxoffice/<YYYY>/<DD-MM>.json   shows on that US business date
//   usa-advance/<YYYY>/<DD-MM>.json     pre-sales for shows on that date
// Each file: { shows: Row[], summary: SummaryRow[] }
//   Row        [showId, "YYYY-MM-DD+HH:MM" (theater-local), format, language,
//               title, movieId, theater, city, state, chain, sold, seats,
//               occupancy %, price, gross]
//   SummaryRow [title, movieId, shows, gross, occupancy %, sold, seats]
// Gross in the source is its own estimate: sold x one ticket price per show.

export type UsKind = 'boxoffice' | 'advance';

export type UsDimension = 'state' | 'city' | 'theater' | 'chain' | 'format' | 'language' | 'format_language';
export const US_DIMENSIONS: UsDimension[] = ['state', 'city', 'theater', 'chain', 'format', 'language', 'format_language'];
// Kept 30 days (large); the others 90.
export const US_DETAIL_DIMENSIONS: UsDimension[] = ['city', 'theater'];

export type UsShow = {
  showId: number;
  local: string; // as published
  dateLocal: string | null;
  timeLocal: string | null;
  format: string;
  language: string;
  title: string;
  sourceMovieId: number;
  theater: string; // as published (not normalized)
  city: string;
  state: string;
  chain: string;
  sold: number;
  seats: number;
  occupancySource: number | null;
  price: number | null;
  gross: number;
};

export type UsSummary = { title: string; sourceMovieId: number; shows: number; gross: number; occupancy: number | null; sold: number; seats: number };

export type UsFile = { shows: UsShow[]; summary: UsSummary[] };

// [[key...], shows, seats, sold, gross, zeroSeatShows, theatres, cities]
export type UsTuple = [string[], number, number, number, number, number, number, number];

export type ReconStatus = 'MATCH' | 'MISMATCH' | 'PARTIAL';

export type UsMovieDay = {
  sourceMovieIds: number[];
  titles: string[];
  gross: number;
  tickets: number;
  seats: number;
  shows: number; // imported show rows
  showsSource: number; // source summary count
  zeroSeatShows: number;
  zeroSeatSold: number;
  occupancy: number | null; // DERIVED: sold on shows with seats / seats
  occupancySource: number | null; // SOURCE (only for a single source id)
  theatres: number;
  cities: number;
  states: number;
  dims: Record<UsDimension, UsTuple[]>;
  recon: Record<string, unknown>;
  summaries: UsSummary[];
  shows_: UsShow[];
};

function num(v: unknown): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}
function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}
const round2 = (v: number) => Math.round(v * 100) / 100;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

// Grouping key text: collapse/trim whitespace only (the raw value is kept
// in us_show). Empty -> "Unknown".
export function clean(v: unknown): string {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return s || 'Unknown';
}

// Throws on anything that isn't the documented shape, so a changed feed
// stops the import instead of storing wrong numbers.
export function parseUsFile(json: unknown): UsFile {
  const j = json as { shows?: unknown; summary?: unknown };
  if (!j || !Array.isArray(j.shows) || !Array.isArray(j.summary)) throw new Error('USA file: expected { shows: [], summary: [] }');
  const shows: UsShow[] = j.shows.map((r: any, i: number) => {
    if (!Array.isArray(r) || r.length < 15) throw new Error(`USA file: show row ${i} has ${Array.isArray(r) ? r.length : 'no'} fields (expected 15)`);
    const local = String(r[1] ?? '');
    const m = /^(\d{4}-\d{2}-\d{2})[+ T](\d{2}:\d{2})/.exec(local);
    return {
      showId: num(r[0]),
      local,
      dateLocal: m ? m[1] : null,
      timeLocal: m ? m[2] : null,
      format: String(r[2] ?? ''),
      language: String(r[3] ?? ''),
      title: String(r[4] ?? ''),
      sourceMovieId: num(r[5]),
      theater: String(r[6] ?? ''),
      city: String(r[7] ?? ''),
      state: String(r[8] ?? ''),
      chain: String(r[9] ?? ''),
      sold: num(r[10]),
      seats: num(r[11]),
      occupancySource: numOrNull(r[12]),
      price: numOrNull(r[13]),
      gross: num(r[14])
    };
  });
  const summary: UsSummary[] = j.summary.map((r: any, i: number) => {
    if (!Array.isArray(r) || r.length < 7) throw new Error(`USA file: summary row ${i} malformed`);
    return { title: String(r[0] ?? ''), sourceMovieId: num(r[1]), shows: num(r[2]), gross: num(r[3]), occupancy: numOrNull(r[4]), sold: num(r[5]), seats: num(r[6]) };
  });
  return { shows, summary };
}

type Acc = { shows: number; seats: number; sold: number; gross: number; zero: number; theatres: Set<string>; cities: Set<string> };
const newAcc = (): Acc => ({ shows: 0, seats: 0, sold: 0, gross: 0, zero: 0, theatres: new Set(), cities: new Set() });

function dimKeys(s: UsShow): Record<UsDimension, string[]> {
  const theater = clean(s.theater);
  const city = clean(s.city);
  const state = clean(s.state);
  const chain = clean(s.chain);
  const format = clean(s.format);
  const language = clean(s.language);
  return {
    state: [state],
    city: [city, state],
    theater: [theater, city, state, chain],
    chain: [chain],
    format: [format],
    language: [language],
    format_language: [format, language]
  };
}

export const theatreId = (s: UsShow) => `${clean(s.theater)}|${clean(s.city)}|${clean(s.state)}`;
export const cityId = (s: UsShow) => `${clean(s.city)}|${clean(s.state)}`;

const sameMoney = (a: number, b: number) => Math.abs(a - b) <= 0.05;

// One Fyre movie's day from one file: all shows of the given source ids.
// Everything except the source summary figures is DERIVED from show rows.
export function aggregateMovie(file: UsFile, sourceMovieIds: number[]): UsMovieDay | null {
  const ids = new Set(sourceMovieIds);
  const shows = file.shows.filter((s) => ids.has(s.sourceMovieId));
  const summaries = file.summary.filter((s) => ids.has(s.sourceMovieId));
  if (shows.length === 0 && summaries.length === 0) return null;

  const dims = Object.fromEntries(US_DIMENSIONS.map((d) => [d, new Map<string, { key: string[]; acc: Acc }>()])) as Record<UsDimension, Map<string, { key: string[]; acc: Acc }>>;
  const theatres = new Set<string>();
  const cities = new Set<string>();
  const states = new Set<string>();
  let gross = 0;
  let sold = 0;
  let seats = 0;
  let zero = 0;
  let zeroSold = 0;
  let soldWithSeats = 0;
  const renamed = new Map<string, string>();
  for (const s of shows) {
    gross += s.gross;
    sold += s.sold;
    seats += s.seats;
    if (s.seats <= 0) {
      zero++;
      zeroSold += s.sold;
    } else soldWithSeats += s.sold;
    const tid = theatreId(s);
    const cid = cityId(s);
    theatres.add(tid);
    cities.add(cid);
    states.add(clean(s.state));
    for (const raw of [s.theater, s.city, s.chain, s.format, s.language]) {
      if (raw !== clean(raw) && renamed.size < 20) renamed.set(raw, clean(raw));
    }
    const keys = dimKeys(s);
    for (const d of US_DIMENSIONS) {
      const k = keys[d];
      const id = k.join('|');
      let e = dims[d].get(id);
      if (!e) dims[d].set(id, (e = { key: k, acc: newAcc() }));
      e.acc.shows++;
      e.acc.seats += s.seats;
      e.acc.sold += s.sold;
      e.acc.gross += s.gross;
      if (s.seats <= 0) e.acc.zero++;
      e.acc.theatres.add(tid);
      e.acc.cities.add(cid);
    }
  }
  const tuples = {} as Record<UsDimension, UsTuple[]>;
  for (const d of US_DIMENSIONS) {
    tuples[d] = [...dims[d].values()]
      .map(({ key, acc }) => [key, acc.shows, acc.seats, acc.sold, round2(acc.gross), acc.zero, acc.theatres.size, acc.cities.size] as UsTuple)
      .sort((a, b) => b[4] - a[4] || b[3] - a[3] || a[0].join('|').localeCompare(b[0].join('|')));
  }

  const src = {
    shows: summaries.reduce((a, s) => a + s.shows, 0),
    gross: round2(summaries.reduce((a, s) => a + s.gross, 0)),
    sold: summaries.reduce((a, s) => a + s.sold, 0),
    seats: summaries.reduce((a, s) => a + s.seats, 0)
  };
  const occupancy = seats > 0 ? round3((soldWithSeats / (seats)) * 100) : null;
  const occupancySource = summaries.length === 1 ? summaries[0].occupancy : null;
  gross = round2(gross);

  const dimRecon: Record<string, ReconStatus> = {};
  for (const d of US_DIMENSIONS) {
    const t = tuples[d];
    const ok =
      sameMoney(t.reduce((a, x) => a + x[4], 0), gross) &&
      t.reduce((a, x) => a + x[3], 0) === sold &&
      t.reduce((a, x) => a + x[1], 0) === shows.length &&
      t.reduce((a, x) => a + x[2], 0) === seats;
    dimRecon[d] = ok ? 'MATCH' : 'MISMATCH';
  }
  const recon = {
    gross: { source: src.gross, rows: gross, status: sameMoney(src.gross, gross) ? 'MATCH' : 'MISMATCH' },
    tickets: { source: src.sold, rows: sold, status: src.sold === sold ? 'MATCH' : 'MISMATCH' },
    seats: { source: src.seats, rows: seats, status: src.seats === seats ? 'MATCH' : 'MISMATCH' },
    shows: { source: src.shows, rows: shows.length, status: src.shows === shows.length ? 'MATCH' : 'MISMATCH' },
    occupancy: {
      source: occupancySource,
      calculated: occupancy,
      status: occupancySource == null || occupancy == null ? 'PARTIAL' : Math.abs(occupancySource - occupancy) <= 0.05 ? 'MATCH' : 'MISMATCH',
      note: 'Source occupancy is not seat-weighted; Fyre shows tickets / seats.'
    },
    occupancyCoverage: zero > 0 ? 'PARTIAL' : 'MATCH',
    zeroSeatShows: zero,
    zeroSeatSold: zeroSold,
    dimensions: dimRecon,
    whitespaceNormalized: [...renamed.entries()].map(([from, to]) => ({ from, to }))
  };

  return {
    sourceMovieIds: [...ids],
    titles: [...new Set([...summaries.map((s) => s.title), ...shows.map((s) => s.title)])],
    gross,
    tickets: sold,
    seats,
    shows: shows.length,
    showsSource: src.shows,
    zeroSeatShows: zero,
    zeroSeatSold: zeroSold,
    occupancy,
    occupancySource,
    theatres: theatres.size,
    cities: cities.size,
    states: states.size,
    dims: tuples,
    recon,
    summaries,
    shows_: shows
  };
}

// Every source movie id in a file with its title and languages.
export function listSourceMovies(file: UsFile): { sourceMovieId: number; title: string; languages: string[]; shows: number }[] {
  const by = new Map<number, { title: string; languages: Set<string>; shows: number }>();
  for (const s of file.summary) by.set(s.sourceMovieId, { title: s.title, languages: new Set(), shows: 0 });
  for (const s of file.shows) {
    let e = by.get(s.sourceMovieId);
    if (!e) by.set(s.sourceMovieId, (e = { title: s.title, languages: new Set(), shows: 0 }));
    e.shows++;
    if (s.language) e.languages.add(clean(s.language));
  }
  return [...by.entries()].map(([sourceMovieId, e]) => ({ sourceMovieId, title: e.title, languages: [...e.languages], shows: e.shows }));
}
