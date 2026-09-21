// Shared types for the TrackTollywood integration (lib/tracktollywood/*).
//
// TrackTollywood (tracktollywood.com) is a WordPress site, unlike
// MovieMint (Next.js). Its box-office data is plain server-rendered HTML
// with clean, semantic class names and no client-side rendering step --
// confirmed live 2026-09-21 via a bare `curl` (no JS execution) against
// both /box-office-collection/ and a movie detail page, and via
// robots.txt (only /wp-admin/ is disallowed). That means this client
// never needs a headless-browser tier the way moviemintClient.ts does.

export type TTMovieState = 'live' | 'advance' | 'upcoming' | 'final' | 'unknown';

// One card from the /box-office-collection/ hub listing.
export type TTListedMovie = {
  slug: string;
  title: string;
  url: string;
  state: TTMovieState;
  dayLabel: string | null; // e.g. "Day 4" -- present once a movie has released
  releaseText: string | null; // e.g. "Released 18 Sep 2026" / "Releasing 25 Sep 2026"
  genre: string | null;
  poster: string | null;
  grossLabel: string | null; // e.g. "India Gross" / "Advance Gross"
  gross: string | null; // display string as shown on site, e.g. "₹5.41 Cr"
  grossCr: number | null; // gross parsed to crores (numeric), null if unparsable
  todayText: string | null; // e.g. "₹42.40 L" -- only present for live movies
  updatedText: string | null; // e.g. "Upd 2026-09-21 18:03 IST"
};

export type TTStat = {
  label: string; // e.g. "Today's Gross", "Best Day"
  value: string; // e.g. "₹42.40L"
  note: string | null; // e.g. "Day 3" (attached to "Best Day")
};

// A table row keyed by its own column headers (from <thead>), so this
// stays correct even if TrackTollywood adds/removes/renames a column --
// nothing here assumes a fixed schema. __isTotal marks the sheet's own
// "TOTAL" summary row when one is present (see parseTableRow's
// colspan-aware cell alignment in scraper.ts).
export type TTTableRow = { __isTotal?: boolean } & Record<string, string>;

// One breakdown table -- covers every kind the brief asks for (day-wise,
// top cities, state-wise, language-wise, format-wise) plus the extra
// ones TrackTollywood happens to publish (time slots, per-advance-date
// breakdowns, cumulative totals). `label` is the site's own
// data-snapshot text (e.g. "State-wise — Day 2", "Cumulative
// Language-wise", "Day-wise Collection") -- descriptive enough to group
// or filter in the frontend without this client having to hard-code a
// day/kind schema that could drift from what the site actually ships.
export type TTTable = {
  label: string;
  headers: string[];
  rows: TTTableRow[];
};

export type TTMovieDetails = {
  slug: string;
  title: string;
  url: string;
  state: TTMovieState;
  poster: string | null;
  badgeText: string | null; // e.g. "Live Tracking · Day 4"
  headlineGross: string | null; // e.g. "₹5.41Cr"
  headlineLabel: string | null; // e.g. "India Gross · Day 4 running"
  stats: TTStat[];
  tables: TTTable[];
  fetchedAt: string; // ISO timestamp of this fetch (not cache-aware -- see cache.ts)
};
