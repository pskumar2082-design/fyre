// Fyre v2 movie data model (supabase/migration_movies_v2.sql). Built for
// Sacnilk as the preferred box-office source, with every figure stored per
// source and per metric, so figures from different sources can never be
// added together.

export type Lifecycle = 'upcoming' | 'now_showing' | 'ending_check' | 'run_ended' | 'archived';

// Money metrics are ₹ crore; occupancy is a percentage; shows is a count.
export type Metric = 'india_net' | 'india_gross' | 'overseas_gross' | 'worldwide_gross' | 'occupancy_pct' | 'shows';

// early_estimate: a day still in progress. estimate: the source's own
// figure (Sacnilk's methodology says all of its figures are estimates).
// reported: a producer's or studio's announced figure, typed in by an
// admin with a link to the announcement.
export type FigureStatus = 'early_estimate' | 'estimate' | 'reported';

export type SourceId = 'sacnilk' | 'reported' | 'demo';

export interface Movie {
  id: string;
  slug: string;
  title: string;
  primaryLanguage: string;
  languages: string[];
  releaseDate: string | null; // YYYY-MM-DD
  posterUrl: string | null;
  certificate: string | null;
  lifecycle: Lifecycle;
  lifecycleSince: string; // ISO
  showOnFyre: boolean; // admin selection for non-Telugu movies
  featured: boolean;
  override: 'running' | 'ended' | null;
  statusReason: string;
  isTestData: boolean;
}

export interface FigureDay {
  movieId: string;
  source: SourceId;
  day: string; // YYYY-MM-DD
  dayNumber: number | null;
  metric: Metric;
  value: number;
  status: FigureStatus;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
}

export interface FigureTotal {
  movieId: string;
  source: SourceId;
  metric: Metric;
  value: number;
  status: FigureStatus;
  asOf: string | null; // the last day the source's total covers
  sourceUpdatedAt: string | null;
  fetchedAt: string;
}

export interface ReportedFigure {
  id: string;
  movieId: string;
  metric: Metric;
  value: number;
  reportedBy: string; // "Producer", "Studio", the company name
  sourceUrl: string;
  reportedOn: string; // YYYY-MM-DD
  enteredBy: string | null;
}

// What the daily lifecycle check knows about a movie.
export interface LifecycleSignals {
  lastShowDate: string | null; // last day any source showed shows
  lastFigureDate: string | null; // last day any source published a figure
  sourcesHealthy: boolean; // every source synced without error today
  endingCheckSince: string | null;
}
