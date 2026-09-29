// Types for the BFILMY data integration (lib/bfilmy/*).
//
// BFILMY (bfilmy.pages.dev) publishes its India box-office tracking as
// plain static JSON files on Cloudflare Pages -- one "final summary"
// file per day for box office, and one per show-date for advance
// bookings (see ./fetch.ts for the exact URLs). BFILMY's owners have
// given fyre permission to use this data; their own terms describe the
// figures as tracked estimates from public booking data, not official
// distributor numbers, so everything downstream labels them that way.

// ---------------------------------------------------------------------------
// Raw file shapes, exactly as BFILMY publishes them
// ---------------------------------------------------------------------------

export type BfRawCity = {
  city: string;
  state: string;
  venues: number;
  shows: number;
  gross: number;
  sold: number;
  totalSeats: number;
  fastfilling: number;
  housefull: number;
  occupancy: number;
};

export type BfRawChain = {
  chain: string;
  venues: number;
  shows: number;
  gross: number;
  sold: number;
  totalSeats: number;
  fastfilling: number;
  housefull: number;
  occupancy: number;
};

// One entry per movie x format x language, keyed like
// "The Paradise [2D | Telugu]".
export type BfRawEntry = {
  shows: number;
  gross: number;
  sold: number;
  totalSeats: number;
  venues: number;
  cities: number;
  fastfilling: number;
  housefull: number;
  occupancy: number;
  details?: BfRawCity[];
  Chain_details?: BfRawChain[];
};

export type BfRawSummaryFile = {
  last_updated?: string; // e.g. "2026-09-28 23:26 IST"
  movies: Record<string, BfRawEntry>;
};

// mergedmovies.json: canonical title -> every spelling BFILMY has seen.
export type BfAliasFile = Record<string, string[]>;

export type BfKind = 'boxoffice' | 'advance';

// ---------------------------------------------------------------------------
// Normalized shapes fyre stores (supabase: bf_movie_day / bf_movie)
// ---------------------------------------------------------------------------

// Only figures that are genuinely additive across formats/languages/days
// are kept at aggregate level. Venue counts are deliberately NOT summed:
// one cinema screening both the 2D and the EPIQ version would be counted
// twice, so an aggregated venue number would be wrong rather than merely
// approximate. Occupancy is always recomputed as sold / totalSeats, which
// is exactly how BFILMY's own per-entry figure is defined (verified
// against their files: 223646 / 1085363 = 20.61%).
export type BfFigures = {
  gross: number;
  sold: number;
  shows: number;
  totalSeats: number;
  fastfilling: number;
  housefull: number;
  occupancy: number; // percent, 0-100, two decimals
};

export type BfNamedRow = BfFigures & { name: string };
export type BfCityRow = BfNamedRow & { state: string | null };

export type BfDayTotals = BfFigures & {
  cities: number; // distinct cities with at least one show (exact)
  languages: string[];
  formats: string[];
};

export type BfDayBreakdown = {
  // Every raw entry for this movie on this day, as BFILMY reported it
  // (format x language), including its own venue/city counts -- those
  // are exact per entry, just not additive across entries.
  entries: (BfFigures & { format: string; language: string; venues: number; cities: number })[];
  states: BfNamedRow[];
  cities: BfCityRow[]; // sorted by gross desc
  chains: BfNamedRow[]; // sorted by gross desc
  formats: BfNamedRow[];
  languages: BfNamedRow[];
};

export type BfMovieDay = {
  key: string; // grouping identity (normalized title) -- see normalize.ts groupKey
  slug: string;
  title: string;
  kind: BfKind;
  date: string; // YYYY-MM-DD (the show date, IST)
  totals: BfDayTotals;
  breakdown: BfDayBreakdown;
  sourceUpdated: string | null;
};

// ---------------------------------------------------------------------------
// Stored (compact) form
// ---------------------------------------------------------------------------
//
// Full city and chain lists are what make exact cumulative tables
// possible, but as objects they're ~1.7MB per day across all movies.
// Stored as positional tuples instead (roughly a third of the size before
// Postgres' own compression). The SQL functions in
// supabase/migration_bfilmy.sql read these same positions -- keep the two
// in sync.
//   city:  [name, state, gross, sold, shows, totalSeats, fastfilling, housefull]
//   chain: [name, gross, sold, shows, totalSeats, fastfilling, housefull]
export type BfCityTuple = [string, string | null, number, number, number, number, number, number];
export type BfChainTuple = [string, number, number, number, number, number, number];

export type BfStoredBreakdown = Omit<BfDayBreakdown, 'cities' | 'chains'> & {
  cities: BfCityTuple[];
  chains: BfChainTuple[];
};
