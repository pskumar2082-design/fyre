// Synthetic MovieMint pages in the same Next.js Flight layout the real site
// serves (self.__next_f.push chunks), built from small hand-made figures.
// The page props mirror moviemintbo.com/movie/<id> (Oct 2026):
//   ["$","$L11",null,{"race":..,"data":{"config":{..},"region":..,"date":..,
//     "metadata":..,"summary":..,"indiaStates":..,..},"availableDates":..,
//     "selectedDate":..,"selectedDates":..,"releaseDate":..,"dailySeries":..,
//     "todayDate":..,"completedMode":..,"completedAsOf":..}]
export type SeriesPoint = { date: string; gross: number; ticketsSold: number; shows: number; avgOccupancy: number; lastUpdated: string; totalSeats?: number };

export type DayBlock = {
  date: string; // YYYYMMDD | 'cumulative'
  lastUpdated: string;
  summary: Record<string, number>;
  indiaStates?: unknown[];
  indiaLanguages?: unknown[];
  indiaFormats?: unknown[];
  indiaTerritories?: unknown[];
  chainBreakdown?: unknown[];
};

export function flightHtml(payload: string, chunkSize = 400): string {
  const parts: string[] = [];
  for (let i = 0; i < payload.length; i += chunkSize) parts.push(payload.slice(i, i + chunkSize));
  return `<!doctype html><html><body><script>(self.__next_f=self.__next_f||[]).push([0])</script>${parts
    .map((p) => `<script>self.__next_f.push([1,${JSON.stringify(p)}])</script>`)
    .join('')}</body></html>`;
}

export function moviePage(o: {
  movieId: string;
  title?: string;
  releaseDate?: string;
  language?: string;
  kind?: 'boxoffice' | 'advance';
  series?: SeriesPoint[];
  day?: DayBlock | null;
  availableDates?: string[];
  todayDate?: string;
  completedAsOf?: string;
  configExtra?: Record<string, unknown>;
  propsExtra?: Record<string, unknown>;
  dataExtra?: Record<string, unknown>;
}): string {
  const config = {
    movieId: o.movieId,
    title: o.title ?? 'Test Movie',
    tmdbId: 1234,
    poster: 'https://image.tmdb.org/t/p/w780/x.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/b.jpg',
    releaseDate: o.releaseDate ?? '2026-09-24',
    language: o.language ?? 'Telugu',
    genres: ['Action', 'Drama'],
    region: 'india',
    searchName: o.title ?? 'Test Movie',
    badge: '$undefined',
    note: '$undefined',
    ...o.configExtra
  };
  const d = o.day;
  const data: Record<string, unknown> = { config };
  if (d) {
    Object.assign(data, {
      region: 'india',
      date: d.date,
      metadata: { lastUpdated: d.lastUpdated, source: 'BookMyShow' },
      summary: d.summary,
      stateBreakdown: [],
      languageBreakdown: [],
      formatBreakdown: [],
      chainBreakdown: d.chainBreakdown ?? [],
      topTheaters: [],
      indiaStates: d.indiaStates ?? [],
      indiaLanguages: d.indiaLanguages ?? [],
      indiaFormats: d.indiaFormats ?? [],
      indiaTerritories: d.indiaTerritories ?? []
    });
  }
  Object.assign(data, o.dataExtra ?? {});
  const kind = o.kind ?? 'boxoffice';
  const props: Record<string, unknown> =
    kind === 'boxoffice'
      ? {
          race: ['$', 'span', null, { className: 'race' }], // nested element before data
          data,
          availableDates: o.availableDates ?? (o.series ?? []).map((p) => p.date),
          selectedDate: d?.date ?? '',
          selectedDates: [d?.date ?? ''],
          releaseDate: config.releaseDate,
          dailySeries: o.series ?? [],
          todayDate: o.todayDate ?? '20261014',
          completedMode: !!o.completedAsOf,
          completedAsOf: o.completedAsOf ?? '$undefined',
          advanceHref: '$undefined'
        }
      : {
          race: '$undefined',
          data,
          availableDates: o.availableDates ?? [d?.date],
          selectedDate: d?.date ?? '',
          selectedDates: [d?.date ?? ''],
          trackedHref: `/movie/${o.movieId}`
        };
  Object.assign(props, o.propsExtra ?? {});
  // A nested null,{...} before the props (as on the real page) must not be
  // mistaken for them.
  const recent = `{"recentTracked":[{"id":"other","title":"Other","boxOfficeId":"other","href":"/movie/other"}],"x":["$","div",null,{"className":"y"}]}`;
  const payload = `0:${recent}\n5:["$","$L11",null,${JSON.stringify(props)}]\n`;
  return flightHtml(payload);
}

export const notFoundPage = () => flightHtml(`5:["$","h1",null,{"children":"Movie Not Found"}]\n`);

export const city = (name: string, state: string, gross: number, extra: Record<string, unknown> = {}) => ({
  name,
  state,
  gross,
  shows: 10,
  ticketsSold: Math.round(gross / 200),
  totalSeats: 2000,
  occupancy: 25,
  venues: 3,
  formats: [{ name: 'Standard', gross }],
  fastFilling: 1,
  houseFull: 0,
  ...extra
});

export function stateRow(name: string, cities: ReturnType<typeof city>[]) {
  const sum = (k: 'gross' | 'shows' | 'ticketsSold' | 'totalSeats' | 'venues' | 'fastFilling' | 'houseFull') => cities.reduce((a, c) => a + (c[k] as number), 0);
  return {
    name,
    gross: sum('gross'),
    ticketsSold: sum('ticketsSold'),
    totalSeats: sum('totalSeats'),
    occupancy: 25,
    shows: sum('shows'),
    venues: sum('venues'),
    fastFilling: sum('fastFilling'),
    houseFull: sum('houseFull'),
    cities
  };
}
