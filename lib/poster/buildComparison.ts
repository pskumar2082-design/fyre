// Turns 2-4 already-fetched ComparisonMovie entries + the admin's chosen
// report/category/alignment/metrics/row-limit into the generic
// ComparisonPosterData lib/poster/blocks.tsx's ComparisonPoster component
// renders. Deliberately built entirely on lib/compare/buildComparison.ts's
// own buildComparison()/buildComparedTable() -- the exact same adapter
// the /compare page and its home-page teaser already use -- rather than a
// second comparison-calculation pipeline, so a poster's numbers can never
// quietly disagree with the live page for the same movies/report.
import type { ComparedReportGroup, ComparisonMovie } from '../compare/types';
import { buildComparison, buildComparedTable } from '../compare/buildComparison';
import type { ComparisonMode } from '../compare/mode';
import { pickDefaultCategory } from '../compare/category';
import { releaseTextFromMeta } from '../tracktollywood/meta';
import { posterToJpg } from './build';
import type { ComparisonPosterData, ComparisonPosterFormat, ComparisonPosterMovie, ComparisonPosterRow, ComparisonPosterStat, PosterRowsMode } from './types';

export type BuildComparisonPosterOptions = {
  mode: ComparisonMode;
  // Which of the active group's own categories (e.g. "State-wise" vs
  // "Language-wise") to render -- falls back to the same
  // pickDefaultCategory() preference the /compare page's own
  // ComparisonGroupView uses when omitted or not actually present on
  // this group.
  category?: string;
  align: 'day' | 'date';
  // A subset of the merged table's own columns to keep, in the given
  // order -- e.g. ["Gross (₹)"] to post just the money column. Omitted
  // or empty keeps every column the movies actually published.
  metrics?: string[];
  rows: PosterRowsMode;
  format: ComparisonPosterFormat;
};

export type BuildComparisonPosterResult = { data: ComparisonPosterData } | { error: string };

// Same shape lib/poster/build.ts's own listAvailableReports() returns for
// a single movie, adapted for a ComparedReportGroup[] union instead --
// used by the admin tool to populate its Report/Breakdown pickers for
// Comparison mode without it having to know anything about
// lib/tracktollywood/tableGroups.ts itself.
export function listAvailableComparisonReports(groups: ComparedReportGroup[]): { heading: string; label: string; categories: string[] }[] {
  return groups.map((g) => ({ heading: g.heading, label: g.headingLabel, categories: g.categories.map((c) => c.category) }));
}

export function buildComparisonPosterData(movies: ComparisonMovie[], options: BuildComparisonPosterOptions): BuildComparisonPosterResult {
  if (movies.length < 2) return { error: 'Pick at least 2 movies to compare.' };
  if (movies.length > 4) return { error: 'At most 4 movies can be compared at once.' };

  const vm = buildComparison(movies);
  const posterMovies: ComparisonPosterMovie[] = vm.movies.map((m) => ({
    title: m.details.title,
    badgeText: m.details.badgeText,
    releaseText: releaseTextFromMeta(m.details.meta),
    posterImageUrl: posterToJpg(m.details.poster)
  }));

  const generatedDateText = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });

  // The same stats union buildComparison() already computed (vm.stats),
  // capped to a handful of headline figures -- a poster has to stay
  // glanceable, unlike the full Overview tab on the live page.
  const summary: ComparisonPosterStat[] = vm.stats.slice(0, 3).map((s) => ({ label: s.label, values: s.values }));

  if (options.mode.kind === 'overview') {
    if (summary.length === 0) return { error: 'None of these movies have published comparable headline stats yet.' };
    return {
      data: {
        movies: posterMovies,
        reportLine: 'Overview',
        alignmentNote: null,
        generatedDateText,
        summary,
        nameColumn: '',
        columns: [],
        rows: [],
        sourceLabel: 'fyre.co.in',
        format: options.format
      }
    };
  }

  const heading =
    options.mode.kind === 'collections' ? 'Day-wise Collection' : options.mode.kind === 'cumulative' ? 'Cumulative' : options.mode.heading;
  const group = vm.groups.find((g) => g.heading === heading);
  if (!group || group.categories.length === 0) {
    return { error: `None of these movies have published "${heading}" data yet.` };
  }

  const categoryName =
    options.category && group.categories.some((c) => c.category === options.category) ? options.category : pickDefaultCategory(group.categories);
  const category = group.categories.find((c) => c.category === categoryName) ?? group.categories[0];

  const hasDateColumn = heading === 'Day-wise Collection' && category.tablesByMovie.some((t) => t?.headers.includes('Date'));
  const merged = buildComparedTable(category.tablesByMovie, hasDateColumn && options.align === 'date' ? { keyColumn: 'Date' } : undefined);

  if (merged.rows.length === 0) {
    return { error: `None of these movies have published rows for "${categoryName}" under "${heading}" yet.` };
  }

  let columns = merged.columns;
  if (options.metrics && options.metrics.length > 0) {
    const wanted = new Set(options.metrics);
    const filtered = columns.filter((c) => wanted.has(c));
    if (filtered.length > 0) columns = filtered;
  }

  let rows = merged.rows;
  if (options.rows !== 'all') rows = rows.slice(0, options.rows);

  const posterRows: ComparisonPosterRow[] = rows.map((r) => ({
    name: r.name,
    valuesByColumn: Object.fromEntries(columns.map((c) => [c, r.valuesByColumn[c] ?? movies.map(() => null)]))
  }));

  const reportLine = group.categories.length > 1 ? `${group.headingLabel} — ${categoryName}` : group.headingLabel;
  const alignmentNote = hasDateColumn
    ? options.align === 'date'
      ? 'Compared by calendar date'
      : 'Compared release-relative: Day 1 vs Day 1'
    : null;

  return {
    data: {
      movies: posterMovies,
      reportLine,
      alignmentNote,
      generatedDateText,
      summary,
      nameColumn: merged.nameColumn,
      columns,
      rows: posterRows,
      sourceLabel: 'fyre.co.in',
      format: options.format
    }
  };
}
