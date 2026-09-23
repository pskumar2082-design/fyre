// Shared types for the Movie vs Movie Comparison feature (lib/compare/*).
//
// TrackTollywood's own data is entirely label-driven -- a stat is
// {label, value, note}, a breakdown table is {label, headers, rows} whose
// meaning comes from string-matching its `label` (see
// lib/tracktollywood/tableGroups.ts). There is no fixed schema of "state/
// language/format" fields anywhere in the live pipeline: whatever
// TrackTollywood published for a specific movie is literally all that
// exists for it. Everything below preserves that -- movies are compared
// by matching label/heading TEXT across the selected movies, never by
// assuming a fixed metric exists on every side. A `null` slot always
// means "this movie has no stat/table/row under this exact label", never
// an invented zero.
import type { TTMovieDetails, TTTable } from '../tracktollywood/types';
import type { HeadingCategory } from '../tracktollywood/tableGroups';

export type ComparisonMovie = {
  slug: string;
  details: TTMovieDetails;
};

// One TrackTollywood stat label (e.g. "Today's Gross", "Best Day"), with
// one value slot per movie in the same order as ComparisonViewModel.movies.
// `null` = this movie's stats array has no entry with this exact label.
export type ComparedStat = {
  label: string;
  values: (string | null)[];
};

// One sub-category within a report group (e.g. "State-wise", "Top
// Cities", "Language-wise", "Format-wise", "Time Slots") -- whichever
// categories actually exist across the selected movies for this heading.
// `tablesByMovie[i]` is null when movie i has no table under this
// heading+category.
export type ComparedCategory = {
  category: string;
  tablesByMovie: (TTTable | null)[];
};

// One report group (a "Day N", "Day-wise Collection", "Cumulative", or
// "Advance <date>" heading -- see lib/tracktollywood/tableGroups.ts),
// unioned across every selected movie's own groupTables() output.
export type ComparedReportGroup = {
  heading: string;
  headingLabel: string;
  category: HeadingCategory;
  categories: ComparedCategory[];
};

export type ComparisonViewModel = {
  movies: ComparisonMovie[];
  // Union of every stat label across the selected movies' details.stats,
  // in first-seen order.
  stats: ComparedStat[];
  // Union of every report-group heading across the selected movies, in
  // reading order: ascending Day N, then Day-wise/Other/Cumulative, then
  // chronological Advance dates -- same order TableGroups.tsx's own three
  // dropdowns already present these in.
  groups: ComparedReportGroup[];
};

// A single merged, side-by-side table for one ComparedCategory across
// every selected movie -- rows matched by their own name-column value
// (state/city/language/format name), columns unioned across whichever
// movies have this category. Built on demand (not eagerly for every
// category) since it's only needed for whichever tab is actually active.
export type ComparedTableRow = {
  name: string;
  // One cell per (column, movie): valuesByColumn[column][movieIndex].
  // null = this movie has no row named `name` for this category, OR that
  // row has no value under this column (TrackTollywood itself omitted
  // it) -- both are "not available for this movie", never a fabricated
  // 0. An actual scraped "0" or "—" stays exactly that string.
  valuesByColumn: Record<string, (string | null)[]>;
};

export type ComparedTable = {
  nameColumn: string;
  columns: string[];
  rows: ComparedTableRow[];
};
