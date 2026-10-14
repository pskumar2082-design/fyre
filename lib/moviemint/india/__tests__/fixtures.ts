// Synthetic MovieMint pages in the same Next.js Flight layout the real site
// serves (self.__next_f.push chunks), built from small hand-made figures.
export type SeriesPoint = { date: string; gross: number; ticketsSold: number; shows: number; avgOccupancy: number; lastUpdated: string; totalSeats?: number };

export type DayBlock = {
  date: string; // YYYYMMDD
  lastUpdated: string;
  summary: Record<string, number>;
  indiaStates?: unknown[];
  indiaLanguages?: unknown[];
  indiaFormats?: unknown[];
  indiaTerritories?: unknown[];
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
}): string {
  const config = {
    movieId: o.movieId,
    title: o.title ?? 'Test Movie',
    tmdbId: 0,
    poster: 'https://image.tmdb.org/t/p/w780/x.jpg',
    releaseDate: o.releaseDate ?? '2026-09-24',
    language: o.language ?? 'Telugu',
    genres: [],
    region: 'india',
    searchName: o.title ?? 'Test Movie',
    badge: '$undefined',
    note: '$undefined'
  };
  const d = o.day;
  const dayJson = d
    ? `,"region":"india","date":"${d.date}","metadata":{"lastUpdated":"${d.lastUpdated}","source":"BookMyShow"},"summary":${JSON.stringify(d.summary)},"stateBreakdown":[],"languageBreakdown":[],"formatBreakdown":[],"chainBreakdown":[],"topTheaters":[],"indiaStates":${JSON.stringify(d.indiaStates ?? [])},"indiaLanguages":${JSON.stringify(d.indiaLanguages ?? [])},"indiaFormats":${JSON.stringify(d.indiaFormats ?? [])},"indiaTerritories":${JSON.stringify(d.indiaTerritories ?? [])}}`
    : '}';
  const tail =
    (o.kind ?? 'boxoffice') === 'boxoffice'
      ? `,"availableDates":${JSON.stringify(o.availableDates ?? (o.series ?? []).map((p) => p.date))},"selectedDate":"${d?.date ?? ''}","selectedDates":["${d?.date ?? ''}"],"releaseDate":"${config.releaseDate}","dailySeries":${JSON.stringify(o.series ?? [])},"todayDate":"${o.todayDate ?? '20261014'}","completedMode":false}`
      : `,"availableDates":${JSON.stringify(o.availableDates ?? [d?.date])},"selectedDate":"${d?.date ?? ''}","completedMode":"$undefined"}`;
  const recent = `{"recentTracked":[{"id":"other","title":"Other","boxOfficeId":"other","href":"/movie/other"}]}`;
  const payload = `0:${recent}\n5:["$","$L13",null,{"config":${JSON.stringify(config)}${dayJson}${tail}]\n`;
  return flightHtml(payload);
}

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
