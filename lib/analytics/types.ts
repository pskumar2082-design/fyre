// Fyre Analytics: the ONE place box-office numbers are computed for the
// movie page, Movie Comparison and the Social Poster. Everything here is
// numeric (never pre-formatted strings) and says where it came from.
//
//   BFILMY files -> lib/bfilmy (import) -> Supabase aggregates
//     -> lib/analytics (this) -> /api/analytics/* -> page / compare / poster
//
// A null metric always means "not available for this selection" (e.g.
// distinct venues can't be added across days for a language row) -- never
// an invented zero.

export type Metrics = {
  gross: number;
  tickets: number;
  shows: number;
  seats: number;
  occupancy: number | null; // percent (tickets / seats)
  atp: number | null; // gross / tickets
  ff: number | null;
  hf: number | null;
  venues: number | null;
  cities: number | null;
  states: number | null;
  picGross: number | null;
  picTickets: number | null;
};

export type MetricKey = 'gross' | 'tickets' | 'shows' | 'occupancy' | 'atp' | 'seats' | 'venues' | 'cities' | 'states' | 'ff' | 'hf' | 'picGross' | 'picTickets';

// What a number is:
//   day        -- one release day (Day N), a finalized or live daily file
//   cumulative -- every box-office date from the first show through Day N
//   lifetime   -- every tracked box-office date
//   advance    -- BFILMY's final advance-booking snapshot for Day N's date
//                 (frozen the night before); never added to box office
export type Basis = 'day' | 'cumulative' | 'lifetime' | 'advance';

export type Selection = { basis: 'day'; day: number } | { basis: 'cumulative'; day: number } | { basis: 'lifetime' } | { basis: 'advance'; day: number };

export type Dimension =
  | 'state'
  | 'city'
  | 'language'
  | 'language_state'
  | 'language_city'
  | 'format'
  | 'chain'
  | 'venue'
  | 'time_slot'
  | 'show_hour'
  | 'price_band'
  | 'pic'
  | 'pic_state'
  | 'pic_city';

export type DayPoint = {
  date: string;
  day: number | null; // release day number (0 = pre-release day before Day 1); null if unknown
  label: string; // "Day 3", "Day 0 (Pre-release)", "Pre-release", or the date
  final: boolean; // the date is over; its numbers won't change
  detail: boolean; // show-level aggregates exist for this date
  breakdowns: boolean; // breakdowns still kept (false once older than the retention window)
  metrics: Metrics;
  sourceUpdated: string | null;
};

export type MovieAnalytics = {
  slug: string;
  title: string;
  poster: string | null;
  languages: string[];
  formats: string[];
  state: import('../boxoffice/types').TTMovieState;
  dayOne: string | null; // Day 1 date (release date as tracked)
  premiereDate: string | null; // Day 0 date, if it had shows
  carriedOver: boolean; // already running on 1 Jan 2025 (release-day numbers unknown)
  latestDay: DayPoint | null;
  days: DayPoint[]; // box office, date order
  advance: DayPoint[]; // advance snapshots, date order
  lifetime: Metrics & { days: number; complete: boolean };
  lastUpdated: string | null;
};

export type BreakdownRow = {
  key: string; // stable across movies (used to line rows up in comparisons)
  name: string;
  sub: string | null; // e.g. state for a city, "City · Chain" for a venue
  metrics: Metrics;
  cumulative?: Metrics; // show_hour only: running totals through this hour
};

export type Breakdown = {
  dimension: Dimension;
  label: string;
  available: boolean;
  reason: string | null; // why not available
  source: 'show-level' | 'summary' | null;
  dates: string[];
  total: number; // rows before any limit
  rows: BreakdownRow[];
};

export type ComparisonMovie = {
  slug: string;
  title: string;
  poster: string | null;
  dayOne: string | null;
  dates: string[]; // the dates that make up this selection
  available: boolean;
  reason: string | null;
  summary: Metrics | null;
  lastUpdated: string | null;
};

export type Comparison = {
  selection: Selection;
  context: string; // "DAY 1 • INDIA • ALL LANGUAGES"
  selectionLabel: string; // "Day 1", "Cumulative through Day 7", "Lifetime", "Advance · Day 1"
  movies: ComparisonMovie[];
  dimension: Dimension | null;
  dimensionLabel: string | null;
  breakdownAvailable: boolean[];
  rows: { key: string; name: string; sub: string | null; values: (Metrics | null)[] }[];
  totalRows: number;
  trend: { metric: MetricKey; cumulative: boolean; points: { day: number; values: (number | null)[] }[] } | null;
  // Release days / advance days any of the movies has (for pickers).
  dayOptions: number[];
  advanceDayOptions: number[];
  lastUpdated: string | null;
  generatedAt: string;
};
