// The generic shape the poster renderer (lib/poster/blocks.tsx) actually
// cares about -- deliberately NOT the TrackTollywood-shaped TTMovieDetails/
// TTTable types, so adding a new report kind later (city-wise, chain-wise,
// a future non-TrackTollywood source) only means writing a new builder
// function that produces this same PosterData, not touching the renderer.
export type PosterStat = { label: string; value: string };

export type PosterData = {
  movieTitle: string;
  // e.g. "Advance · 24 Sept — State-wise"
  reportLine: string;
  // e.g. "22 Sep 2026" -- when this poster was generated
  generatedDateText: string;
  // TrackTollywood's own "Last updated ..." text, passed through verbatim
  // (already includes "IST"); null when the source didn't publish one.
  updatedText: string | null;
  badgeText: string | null;
  // Gross / Tickets / Shows (whichever are available) for the selected
  // report -- see lib/poster/build.ts's buildSummary for exactly where
  // each one comes from and why none of them are invented.
  summary: PosterStat[];
  columns: string[];
  rows: Record<string, string>[];
  posterImageUrl: string | null;
  sourceLabel: string; // e.g. "Source: TrackTollywood"
};

export type PosterRowsMode = 'all' | number;

// ---------------------------------------------------------------------
// Comparison poster (Movie vs Movie) -- the generic shape
// lib/poster/blocks.tsx's ComparisonPoster component renders, produced
// by lib/poster/buildComparison.ts from the SAME lib/compare/
// buildComparison.ts view model the /compare page and the Social Poster
// Comparison mode both already share (see lib/compare/types.ts's own
// "never a duplicate calculation pipeline" note) -- this type only adds
// the presentation-specific pieces a single-movie PosterData doesn't
// need (per-movie identity, an optional alignment note, and the target
// canvas format).
// ---------------------------------------------------------------------
export type ComparisonPosterFormat = '1080x1350' | '1080x1080' | 'auto';

export type ComparisonPosterMovie = {
  title: string;
  badgeText: string | null;
  releaseText: string | null;
  posterImageUrl: string | null;
};

// One stat label with one value slot per movie (same null-means-N/A
// contract as lib/compare/types.ts's own ComparedStat) -- used for the
// poster's compact headline-figures row (e.g. "India Gross").
export type ComparisonPosterStat = {
  label: string;
  values: (string | null)[];
};

export type ComparisonPosterRow = {
  name: string;
  valuesByColumn: Record<string, (string | null)[]>;
};

export type ComparisonPosterData = {
  movies: ComparisonPosterMovie[]; // 2-4, in display order (also the color/legend order)
  reportLine: string; // e.g. "Day-wise Collection — Day 1 vs Day 1" / "Cumulative — State-wise"
  alignmentNote: string | null; // e.g. "Release-relative: Day 1 vs Day 1" / "By calendar date" -- Day-wise Collection only
  generatedDateText: string;
  summary: ComparisonPosterStat[];
  nameColumn: string;
  columns: string[];
  rows: ComparisonPosterRow[];
  sourceLabel: string;
  format: ComparisonPosterFormat;
};
