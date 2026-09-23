// Pure, no-React, no-server-only-deps adapter: N already-fetched
// TTMovieDetails -> a ComparisonViewModel (see ./types.ts). Reuses
// lib/tracktollywood/tableGroups.ts's own grouping/labeling/sorting
// logic as-is (groupTables/headingLabel/categoryOf/categoryLabel/
// sortBoxOfficeHeadings/sortAdvanceHeadings) rather than reimplementing
// it -- so "which report groups exist and in what order" can never
// quietly drift from what the single-movie page (components/
// TableGroups.tsx) and the Social Poster (lib/poster/build.ts) already
// agree on. This file adds only the UNIONING needed to compare 2-4
// movies side by side; it invents no new grouping rules of its own.
//
// Every union below is "first-seen order across the selected movies" --
// deterministic given a fixed movie selection, and never reorders a
// movie's own data, only decides where a NEW label/heading/row that
// hasn't been seen yet gets inserted into the merged list.
import type { TTTable } from '../tracktollywood/types';
import {
  groupTables,
  headingLabel,
  categoryOf,
  categoryLabel,
  sortBoxOfficeHeadings,
  sortAdvanceHeadings,
  type TableGroup
} from '../tracktollywood/tableGroups';
import { isRankColumn, nameColumnIndex } from '../tableFormat';
import type {
  ComparisonMovie,
  ComparisonViewModel,
  ComparedStat,
  ComparedReportGroup,
  ComparedTable,
  ComparedTableRow
} from './types';

function dayNumber(heading: string): number | null {
  const m = heading.match(/^Day (\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function uniqueHeadings(perMovieGroups: TableGroup[][], predicate: (heading: string) => boolean): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const groups of perMovieGroups) {
    for (const g of groups) {
      if (predicate(g.heading) && !seen.has(g.heading)) {
        seen.add(g.heading);
        order.push(g.heading);
      }
    }
  }
  return order;
}

// Union of every stat label (e.g. "Today's Gross", "Best Day") across
// the selected movies' own details.stats, each with one value slot per
// movie -- null where that movie's stat cards simply don't include this
// label. A movie with two stats sharing a label (not seen in practice)
// keeps the first rather than silently overwriting it with the second.
function buildComparedStats(movies: ComparisonMovie[]): ComparedStat[] {
  const order: string[] = [];
  const byLabel = new Map<string, (string | null)[]>();

  movies.forEach((movie, idx) => {
    for (const stat of movie.details.stats) {
      if (!byLabel.has(stat.label)) {
        byLabel.set(stat.label, movies.map(() => null));
        order.push(stat.label);
      }
      const slot = byLabel.get(stat.label)!;
      if (slot[idx] == null) slot[idx] = stat.value;
    }
  });

  return order.map((label) => ({ label, values: byLabel.get(label)! }));
}

function buildGroupForHeading(heading: string, perMovieGroups: (TableGroup | undefined)[]): ComparedReportGroup {
  const categoryOrder: string[] = [];
  const tablesByCategory = new Map<string, (TTTable | null)[]>();

  perMovieGroups.forEach((group, movieIdx) => {
    if (!group) return;
    for (const table of group.tables) {
      const category = categoryLabel(table, heading);
      if (!tablesByCategory.has(category)) {
        tablesByCategory.set(
          category,
          perMovieGroups.map(() => null)
        );
        categoryOrder.push(category);
      }
      tablesByCategory.get(category)![movieIdx] = table;
    }
  });

  return {
    heading,
    headingLabel: headingLabel(heading),
    category: categoryOf(heading),
    categories: categoryOrder.map((category) => ({ category, tablesByMovie: tablesByCategory.get(category)! }))
  };
}

export function buildComparison(movies: ComparisonMovie[]): ComparisonViewModel {
  const perMovieGroups = movies.map((m) => groupTables(m.details.tables));

  // Same three-way split TableGroups.tsx's Tracked Days / Box Office /
  // Advance dropdowns already use, unioned across movies instead of read
  // from one: every "Day N" any selected movie has, ascending; the fixed
  // Day-wise/Other/Cumulative order; every "Advance <date>" any selected
  // movie has, chronological.
  const dayHeadings = uniqueHeadings(perMovieGroups, (h) => categoryOf(h) === 'day').sort(
    (a, b) => (dayNumber(a) ?? 0) - (dayNumber(b) ?? 0)
  );
  const boxofficeHeadings = sortBoxOfficeHeadings(
    uniqueHeadings(perMovieGroups, (h) => categoryOf(h) === 'boxoffice').map((heading) => ({ heading }))
  ).map((g) => g.heading);
  const advanceHeadings = sortAdvanceHeadings(
    uniqueHeadings(perMovieGroups, (h) => categoryOf(h) === 'advance').map((heading) => ({ heading }))
  ).map((g) => g.heading);

  const groups = [...dayHeadings, ...boxofficeHeadings, ...advanceHeadings].map((heading) => {
    const perMovie = perMovieGroups.map((groupsForMovie) => groupsForMovie.find((g) => g.heading === heading));
    return buildGroupForHeading(heading, perMovie);
  });

  return { movies, stats: buildComparedStats(movies), groups };
}

// Merges one ComparedCategory's tables (one slot per movie, some
// possibly null) into a single side-by-side ComparedTable: rows matched
// by their own name-column value (state/city/language/format/day name),
// columns unioned across whichever movies have this category. A row a
// movie doesn't have, or a column value it didn't publish, is `null` --
// never a fabricated 0 -- while an actual scraped "0" or the site's own
// "—" convention passes through unchanged.
//
// `keyColumn` overrides which column rows are matched by -- the
// Day-wise Collection table carries both a "Day" column (release-
// relative) and a real scraped "Date" column (calendar-date), and the
// comparison UI's time-alignment toggle needs to key by either one
// without a second merge implementation. When a movie's table doesn't
// have `keyColumn` (shouldn't happen for Day/Date, but data is data),
// that movie falls back to its table's own default name column rather
// than being silently dropped from the comparison.
export function buildComparedTable(tablesByMovie: (TTTable | null)[], options?: { keyColumn?: string }): ComparedTable {
  const firstTable = tablesByMovie.find((t): t is TTTable => t != null);
  if (!firstTable) return { nameColumn: '', columns: [], rows: [] };

  const requestedKey = options?.keyColumn;
  const nameColumn = requestedKey && firstTable.headers.includes(requestedKey) ? requestedKey : firstTable.headers[nameColumnIndex(firstTable.headers)];

  function keyHeaderFor(table: TTTable): string {
    if (requestedKey && table.headers.includes(requestedKey)) return requestedKey;
    return table.headers[nameColumnIndex(table.headers)];
  }

  const columns: string[] = [];
  const columnSet = new Set<string>();
  for (const table of tablesByMovie) {
    if (!table) continue;
    const keyHeader = keyHeaderFor(table);
    for (const h of table.headers) {
      if (isRankColumn(h) || h === keyHeader) continue;
      if (!columnSet.has(h)) {
        columnSet.add(h);
        columns.push(h);
      }
    }
  }

  const rows: ComparedTableRow[] = [];
  const rowIndexByName = new Map<string, number>();

  tablesByMovie.forEach((table, movieIdx) => {
    if (!table) return;
    const keyHeader = keyHeaderFor(table);
    for (const row of table.rows) {
      if (row.__isTotal) continue;
      const name = row[keyHeader] ?? '';
      if (!name) continue;

      let rowIdx = rowIndexByName.get(name);
      if (rowIdx == null) {
        rowIdx = rows.length;
        rowIndexByName.set(name, rowIdx);
        const valuesByColumn: Record<string, (string | null)[]> = {};
        for (const col of columns) valuesByColumn[col] = tablesByMovie.map(() => null);
        rows.push({ name, valuesByColumn });
      }

      for (const col of columns) {
        const raw = row[col];
        if (raw != null && raw !== '') {
          rows[rowIdx].valuesByColumn[col][movieIdx] = raw;
        }
      }
    }
  });

  return { nameColumn, columns, rows };
}
