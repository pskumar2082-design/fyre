// Pure normalization of BFILMY's raw summary files into fyre's per-movie,
// per-day shape. No network, no database -- everything here is unit
// tested against fixtures (see __tests__/normalize.test.ts).
import type {
  BfAliasFile,
  BfChainTuple,
  BfCityTuple,
  BfStoredBreakdown,
  BfCityRow,
  BfDayBreakdown,
  BfFigures,
  BfKind,
  BfMovieDay,
  BfNamedRow,
  BfRawEntry,
  BfRawSummaryFile
} from './types';

// "The Paradise [DOLBY CINEMA 2D | Telugu]" -> title/format/language.
// Falls back to the whole key as the title (format/language "Unknown")
// rather than dropping an entry whose key doesn't match -- a movie
// missing from fyre would be a worse failure than one oddly labelled.
export function parseEntryKey(key: string): { title: string; format: string; language: string } {
  const m = key.match(/^(.*?)\s*\[([^|\]]+)\|\s*([^\]]+)\]\s*$/);
  if (!m) return { title: key.trim(), format: 'Unknown', language: 'Unknown' };
  return { title: m[1].trim(), format: m[2].trim(), language: m[3].trim() };
}

// Loose comparison key for matching titles across BFILMY's own spelling
// variants and the District poster list: case, punctuation and spacing
// never distinguish two different films.
export function titleKey(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function slugify(title: string): string {
  const s = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'movie';
}

// Suffixes BFILMY's listings append to the SAME film's title: a dubbed
// version tagged with its language ("Youth (Telugu)", "Alpha (Hindi)") and
// women-only special screenings ("Jana Nayagan (Exclusively For Women)").
// Only these exact shapes are stripped -- anything else in brackets stays,
// because a looser rule would merge genuinely different films.
const LANGUAGE_TAG =
  /\s*[([]\s*(hindi|telugu|tamil|malayalam|kannada|marathi|bengali|bangla|punjabi|gujarati|odia|oriya|english|assamese|bhojpuri|urdu|tulu|konkani|nepali|chhattisgarhi|chattisgarhi|rajasthani|haryanvi|japanese|korean|chinese|spanish|french)(\s+(version|dubbed|dub))?\s*[)\]]\s*$/i;
const WOMEN_SCREENING_TAG = /\s*[([][^)\]]*\bwomen\b[^)\]]*[)\]]\s*$/i;

export function baseTitle(rawTitle: string): string {
  let t = rawTitle.replace(/\s+/g, ' ').trim();
  for (;;) {
    const next = t.replace(LANGUAGE_TAG, '').replace(WOMEN_SCREENING_TAG, '').trim();
    if (!next || next === t) return t;
    t = next;
  }
}

// Spelling variants of the same film that no automatic rule can safely
// catch (a looser rule would also merge sequels and look-alike titles --
// e.g. "Jolly LLB 2" / "Jolly LLB 3"). Each entry was checked against
// BFILMY's own data: same language, overlapping show dates, and one
// listing clearly the main one. Add to this list only after the same
// check -- a wrong entry merges two films' collections.
export const FYRE_ALIASES: Record<string, string[]> = {
  Thamma: ['Thama'],
  'Housefull 5': ['Housefull 5b', 'Housefull 5a'],
  'Demon Slayer: Kimetsu No Yaiba Infinity Castle': ['Demon Slayer - Kimetsu No Yaiba - The Movie: Infinity Castle'],
  'Vaazha II: Biopic of a Billion Bros': ['Vaala 2: Biopic Of A Billion Bros'],
  'Krishnavataram Part 1: The Heart': ['Krishnavataram Part 1: The Heart [Hridayam]'],
  'Pushpa 2: The Rule': ['Pushpa 2: The Rule Reloaded'],
  // Transliteration variants (same language, 95%+ identical spelling,
  // 19-34 shared show days in BFILMY's data):
  Rakkasapuradol: ['Rakkasapuradhol'],
  'Mahendragiri Varahi': ['Mahendragiri Vaaraahi'],
  'Valathu Vasathe Kallan': ['Valathu Vashathe Kallan'],
  'Sambhavam Adhyayam Onnu': ['Sambhavam Adhyam Onnu'],
  'Hrudhayam Murali': ['Hrudayam Murali'],
  // One film listed under a different name per ticketing platform: every
  // "Hi (2026)" show is BookMyShow's (s=B), every "Hi" show District's
  // (s=D); same release day (28 Aug 2026), same languages, zero shared
  // venues. BFILMY normally joins both platforms under one title.
  'Hi (2026)': ['Hi']
};
// After adding an entry here, the variant's already-stored days must be
// moved: delete its slug's rows (bf_movie_day, bf_movie, bf_title_key) and
// re-import the dates it appeared on (scripts/bfilmy-backfill.ts).


// variant titleKey -> canonical display title, from BFILMY's own
// mergedmovies.json plus FYRE_ALIASES (ours win on conflict).
export function buildAliasMap(aliases: BfAliasFile | null | undefined, extra: BfAliasFile = FYRE_ALIASES): Map<string, string> {
  const map = new Map<string, string>();
  for (const source of [aliases ?? {}, extra]) {
    for (const [canonical, variants] of Object.entries(source)) {
      const display = canonical.replace(/\s+/g, ' ').trim();
      map.set(titleKey(baseTitle(canonical)), display);
      for (const v of variants ?? []) map.set(titleKey(baseTitle(v)), display);
    }
  }
  return map;
}

export function canonicalTitle(rawTitle: string, aliasMap: Map<string, string>): string {
  const base = baseTitle(rawTitle);
  return aliasMap.get(titleKey(base)) ?? base;
}

// The identity two listings must share to be treated as one film.
export function groupKey(rawTitle: string, aliasMap: Map<string, string>): string {
  return titleKey(canonicalTitle(rawTitle, aliasMap));
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptyFigures(): BfFigures {
  return { gross: 0, sold: 0, shows: 0, totalSeats: 0, fastfilling: 0, housefull: 0, occupancy: 0 };
}

function addInto(target: BfFigures, src: Partial<Record<keyof BfFigures, unknown>>) {
  target.gross += num(src.gross);
  target.sold += num(src.sold);
  target.shows += num(src.shows);
  target.totalSeats += num(src.totalSeats);
  target.fastfilling += num(src.fastfilling);
  target.housefull += num(src.housefull);
}

export function finalizeFigures<T extends BfFigures>(f: T): T {
  f.gross = Math.round(f.gross * 100) / 100;
  f.occupancy = f.totalSeats > 0 ? Math.round((f.sold / f.totalSeats) * 10000) / 100 : 0;
  return f;
}

function sortedRows<T extends BfNamedRow>(map: Map<string, T>): T[] {
  return [...map.values()].map(finalizeFigures).sort((a, b) => b.gross - a.gross || b.sold - a.sold || a.name.localeCompare(b.name));
}

function bucket<V>(map: Map<string, V>, key: string, make: () => V): V {
  let row = map.get(key);
  if (!row) {
    row = make();
    map.set(key, row);
  }
  return row;
}

// Groups one BFILMY summary file into one BfMovieDay per movie. Every
// entry for the same canonical title (all formats, all dubbed languages)
// becomes one movie; states/cities/chains/formats/languages are exact sums
// of BFILMY's own per-entry figures.
export function normalizeSummaryFile(
  file: BfRawSummaryFile,
  kind: BfKind,
  date: string,
  aliasMap: Map<string, string>
): BfMovieDay[] {
  type Group = { title: string; entries: { key: string; format: string; language: string; e: BfRawEntry }[] };
  const groups = new Map<string, Group>();

  for (const [key, e] of Object.entries(file?.movies ?? {})) {
    if (!e || typeof e !== 'object') continue;
    const parsed = parseEntryKey(key);
    const title = canonicalTitle(parsed.title, aliasMap);
    const gk = titleKey(title) || slugify(title);
    const g = bucket<Group>(groups, gk, () => ({ title, entries: [] }));
    g.entries.push({ key, format: parsed.format, language: parsed.language, e });
  }

  const out: BfMovieDay[] = [];
  for (const [gk, g] of groups) {
    const totals = emptyFigures();
    const states = new Map<string, BfNamedRow>();
    const cities = new Map<string, BfCityRow>();
    const chains = new Map<string, BfNamedRow>();
    const formats = new Map<string, BfNamedRow>();
    const languages = new Map<string, BfNamedRow>();
    const entries: BfDayBreakdown['entries'] = [];

    for (const { format, language, e } of g.entries) {
      addInto(totals, e);
      entries.push(
        finalizeFigures({
          ...emptyFigures(),
          gross: num(e.gross),
          sold: num(e.sold),
          shows: num(e.shows),
          totalSeats: num(e.totalSeats),
          fastfilling: num(e.fastfilling),
          housefull: num(e.housefull),
          format,
          language,
          venues: num(e.venues),
          cities: num(e.cities)
        })
      );
      addInto(bucket(formats, format, () => ({ ...emptyFigures(), name: format })), e);
      addInto(bucket(languages, language, () => ({ ...emptyFigures(), name: language })), e);

      for (const c of e.details ?? []) {
        const stateName = (c.state || '').trim() || 'Unknown';
        const cityName = (c.city || '').trim() || 'Unknown';
        addInto(bucket(states, stateName, () => ({ ...emptyFigures(), name: stateName })), c);
        addInto(
          bucket(cities, `${cityName}|${stateName}`, () => ({ ...emptyFigures(), name: cityName, state: c.state?.trim() || null })),
          c
        );
      }
      for (const ch of e.Chain_details ?? []) {
        const chainName = (ch.chain || '').trim() || 'Unknown';
        addInto(bucket(chains, chainName, () => ({ ...emptyFigures(), name: chainName })), ch);
      }
    }

    finalizeFigures(totals);
    entries.sort((a, b) => b.gross - a.gross);
    out.push({
      key: gk,
      // Provisional -- the sync job swaps in the stable slug/title stored
      // for this key (bf_title_key), so a film keeps one URL no matter
      // which spelling a given day's file uses.
      slug: slugify(g.title),
      title: g.title,
      kind,
      date,
      totals: {
        ...totals,
        cities: cities.size,
        languages: [...languages.keys()].sort(),
        formats: [...formats.keys()].sort()
      },
      breakdown: {
        entries,
        states: sortedRows(states),
        cities: sortedRows(cities),
        chains: sortedRows(chains),
        formats: sortedRows(formats),
        languages: sortedRows(languages)
      },
      sourceUpdated: file?.last_updated ?? null
    });
  }

  return out.sort((a, b) => b.totals.gross - a.totals.gross);
}

// District's movie list rows: [id, title, altTitle, language, ?, runtime,
// certificate, posterUrl, ?]. Returns titleKey -> poster URL.
export function buildPosterMap(rows: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!Array.isArray(rows)) return map;
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    const poster = typeof r[7] === 'string' && /^https?:\/\//.test(r[7]) ? r[7] : null;
    if (!poster) continue;
    for (const t of [r[1], r[2]]) {
      if (typeof t === 'string' && t.trim()) {
        const k = titleKey(t);
        if (!map.has(k)) map.set(k, poster);
      }
    }
  }
  return map;
}

// Compact storage form (see BfStoredBreakdown in ./types.ts) and back.
export function toStoredBreakdown(b: BfDayBreakdown): BfStoredBreakdown {
  return {
    entries: b.entries,
    states: b.states,
    formats: b.formats,
    languages: b.languages,
    cities: b.cities.map((c): BfCityTuple => [c.name, c.state, c.gross, c.sold, c.shows, c.totalSeats, c.fastfilling, c.housefull]),
    chains: b.chains.map((c): BfChainTuple => [c.name, c.gross, c.sold, c.shows, c.totalSeats, c.fastfilling, c.housefull])
  };
}

export function cityFromTuple(t: unknown[]): BfCityRow {
  return finalizeFigures({
    name: String(t[0] ?? ''),
    state: t[1] == null ? null : String(t[1]),
    gross: num(t[2]),
    sold: num(t[3]),
    shows: num(t[4]),
    totalSeats: num(t[5]),
    fastfilling: num(t[6]),
    housefull: num(t[7]),
    occupancy: 0
  });
}

export function chainFromTuple(t: unknown[]): BfNamedRow {
  return finalizeFigures({
    name: String(t[0] ?? ''),
    gross: num(t[1]),
    sold: num(t[2]),
    shows: num(t[3]),
    totalSeats: num(t[4]),
    fastfilling: num(t[5]),
    housefull: num(t[6]),
    occupancy: 0
  });
}
