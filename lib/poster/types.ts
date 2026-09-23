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
