// Shared, pure (no React, no server-only deps) grouping/labeling logic for
// TrackTollywood's flat per-movie table list -- built once for the movie
// detail page's dropdown UI (components/TableGroups.tsx) and reused as-is
// by the Social Poster admin tool, so "which Report / which Breakdown" is
// computed identically everywhere rather than as a second implementation
// that could quietly drift from the live page's own grouping.
import type { TTTable } from './types';

export type TableGroup = { heading: string; tables: TTTable[] };

// Groups TrackTollywood's flat table list (54+ tables for a well-into-its-run
// movie) into sections a person can actually scan: one per release day, one
// per advance-booking date, and a Cumulative section -- instead of one long
// unlabeled list. Pure string matching on the site's own data-snapshot
// labels (e.g. "Top Cities — Day 2", "Advance 2026-09-18 — State-wise",
// "Cumulative Language-wise") -- no hard-coded day count, so this keeps
// working as a movie's run gets longer or an advance window changes.
export function groupTables(tables: TTTable[]): TableGroup[] {
  const groups = new Map<string, TTTable[]>();
  const order: string[] = [];

  for (const t of tables) {
    let heading: string;
    if (t.label === 'Day-wise Collection') heading = 'Day-wise Collection';
    else if (/Cumulative/i.test(t.label)) heading = 'Cumulative';
    else if (/^Advance /i.test(t.label)) heading = t.label.split(' — ')[0]; // "Advance 2026-09-18"
    else {
      const m = t.label.match(/— (Day \d+)$/);
      heading = m ? m[1] : 'Other';
    }
    if (!groups.has(heading)) {
      groups.set(heading, []);
      order.push(heading);
    }
    groups.get(heading)!.push(t);
  }

  return order.map((heading) => ({ heading, tables: groups.get(heading)! }));
}

// The human-readable "Report" label for a group heading -- e.g. "Advance
// 2026-09-24" -> "Advance · 24 Sept". Pinned to UTC: TrackTollywood's
// snapshot date parses as UTC midnight, and formatting it in whatever
// timezone happens to be running this code (a viewer's browser for the
// dropdown, a server for the poster route) would otherwise shift the
// printed day backwards by one for anyone/anything behind UTC -- the exact
// bug fixed in components/TableGroups.tsx earlier; kept here so the fix
// can't be silently lost by a second implementation.
export function headingLabel(heading: string): string {
  if (heading === 'Day-wise Collection') return 'Day-wise Collection';
  if (heading === 'Cumulative') return 'Cumulative — All Days';
  if (heading.startsWith('Advance ')) {
    const raw = heading.slice('Advance '.length);
    const d = new Date(raw);
    return Number.isNaN(d.getTime())
      ? heading
      : `Advance · ${d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
  }
  return heading;
}

// TrackTollywood's own data-snapshot labels always carry the group's
// heading as a prefix or suffix -- "Top Cities — Day 2" (heading "Day
// 2"), "Advance 2026-09-18 — State-wise" (heading "Advance
// 2026-09-18"), "Cumulative Language-wise" (heading "Cumulative"). Strip
// whichever side matches to get the clean category name ("State-wise",
// "Top Cities", ...); fall back to the raw label for a single-table group
// like "Day-wise Collection", where nothing is left after stripping.
// Which of the three navigation categories a group heading belongs to --
// used by the movie page's breakdown selector (components/TableGroups.tsx)
// to section "Day 1..N" / "Day-wise Collection, Other, Cumulative" /
// "Advance <date>" into three clearly-labeled groups instead of one flat
// list. Pure string matching on the same heading values groupTables()
// already produces -- nothing here is a second source of truth for what
// headings exist.
export type HeadingCategory = 'day' | 'boxoffice' | 'advance';

export function categoryOf(heading: string): HeadingCategory {
  if (/^Day \d+$/.test(heading)) return 'day';
  if (heading.startsWith('Advance ')) return 'advance';
  return 'boxoffice';
}

// "Day-wise / Other / Cumulative" -- a fixed, sensible reading order
// rather than whatever order TrackTollywood's own table list happened to
// produce them in. Anything unrecognized (there isn't one today, but a
// future report type would fall in here rather than vanishing) sorts
// after the three known headings, alphabetically among themselves.
const BOX_OFFICE_ORDER = ['Day-wise Collection', 'Other', 'Cumulative'];
export function sortBoxOfficeHeadings<T extends { heading: string }>(groups: T[]): T[] {
  return groups.slice().sort((a, b) => {
    const ia = BOX_OFFICE_ORDER.indexOf(a.heading);
    const ib = BOX_OFFICE_ORDER.indexOf(b.heading);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.heading.localeCompare(b.heading);
  });
}

// Advance dates aren't guaranteed to already be in date order (they're
// just whatever order the tables appear in TrackTollywood's own flat
// list) -- parse each "Advance 2026-09-18" heading's date and sort on
// that explicitly, oldest first. A heading that somehow fails to parse
// (shouldn't happen given groupTables()'s own regex, but data is data)
// falls back to string order rather than throwing.
export function sortAdvanceHeadings<T extends { heading: string }>(groups: T[]): T[] {
  return groups.slice().sort((a, b) => {
    const da = Date.parse(a.heading.slice('Advance '.length));
    const db = Date.parse(b.heading.slice('Advance '.length));
    if (Number.isNaN(da) || Number.isNaN(db)) return a.heading.localeCompare(b.heading);
    return da - db;
  });
}

export function categoryLabel(table: TTTable, heading: string): string {
  let label = table.label;
  if (label.startsWith(heading)) label = label.slice(heading.length);
  else if (label.endsWith(heading)) label = label.slice(0, label.length - heading.length);
  label = label.replace(/^[\s—-]+|[\s—-]+$/g, '');
  return label || table.label;
}
