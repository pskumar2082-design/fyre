// Turns an already-fetched TTMovieDetails + a chosen (report heading,
// breakdown table) into the generic PosterData the renderer consumes --
// selection and reshaping only. No independent data source: every value
// here traces back to the exact same getMovieDetails() call that powers
// the live /movie/[slug] page (see lib/tracktollywood/scraper.ts), so the
// poster and the site can never quietly disagree.
import type { TTMovieDetails, TTTable } from '../tracktollywood/types';
import { groupTables, headingLabel, categoryLabel } from '../tracktollywood/tableGroups';
import type { PosterData, PosterStat } from './types';

export type BuildPosterResult = { data: PosterData; table: TTTable } | { error: string };

// TrackTollywood's own table cells are already fully formatted for
// display ("₹9.99 Cr", "389,238", "50.1%") -- this project has never
// kept a separate raw-numeric column for a breakdown row (confirmed
// against lib/tracktollywood/types.ts's TTTableRow, which is just
// Record<string,string>). None of these breakdown tables ship a TOTAL row
// either (confirmed live), so a Gross/Tickets/Shows summary for a
// specific table has to be derived by summing that table's own rows --
// there's nowhere else it could honestly come from. These two parsers
// exist ONLY for that one purpose: turning the exact strings already
// rendered in the table below the summary back into numbers just long
// enough to add them up, then re-formatting with the same convention
// TrackTollywood's own cells already use (so a viewer never sees two
// different number styles on the same poster).
function parseGrossToRupees(text: string): number | null {
  const cleaned = text.replace(/,/g, '').trim();
  const crMatch = cleaned.match(/([\d.]+)\s*Cr/i);
  if (crMatch) return Number(crMatch[1]) * 1e7;
  const lMatch = cleaned.match(/([\d.]+)\s*L/i);
  if (lMatch) return Number(lMatch[1]) * 1e5;
  const plain = cleaned.match(/[₹]?\s*([\d.]+)/);
  if (plain) return Number(plain[1]);
  return null;
}

function formatRupees(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-US')}`;
}

function parseCount(text: string): number | null {
  const n = Number(text.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

// Finds the header whose name matches `pattern` and sums every row's value
// under it, formatting the total with `format`. Returns null (not a
// fabricated "0") when the table has no matching column, so a report type
// that doesn't publish a given figure just omits that summary stat rather
// than showing a wrong one.
function sumColumn(table: TTTable, pattern: RegExp, parse: (t: string) => number | null, format: (n: number) => string): string | null {
  const header = table.headers.find((h) => pattern.test(h));
  if (!header) return null;
  let total = 0;
  let sawAny = false;
  for (const row of table.rows) {
    if (row.__isTotal) continue;
    const raw = row[header];
    if (raw == null || raw === '') continue;
    const n = parse(raw);
    if (n == null) continue;
    total += n;
    sawAny = true;
  }
  return sawAny ? format(total) : null;
}

function buildSummary(table: TTTable): PosterStat[] {
  const stats: PosterStat[] = [];
  const gross = sumColumn(table, /gross|collection/i, parseGrossToRupees, formatRupees);
  if (gross) stats.push({ label: 'Gross', value: gross });
  const tickets = sumColumn(table, /ticket/i, parseCount, formatCount);
  if (tickets) stats.push({ label: 'Tickets', value: tickets });
  const shows = sumColumn(table, /show/i, parseCount, formatCount);
  if (shows) stats.push({ label: 'Shows', value: shows });
  return stats;
}

// Satori/resvg (what next/og renders images with) can't decode WebP --
// TrackTollywood's lazy-loaded posters are served via a Smush-plugin WebP
// path, but the same asset also exists at the plain pre-Smush .jpg path
// (what its own <noscript> fallback uses). Swap to that if the URL
// matches the expected pattern; otherwise drop the poster image entirely
// rather than risk another unrenderable-image failure.
function posterToJpg(url: string | null): string | null {
  if (!url) return null;
  const jpg = url.replace('/wp-content/smush-webp/', '/wp-content/uploads/').replace(/\.jpg\.webp$/, '.jpg');
  return jpg !== url ? jpg : null;
}

export function listAvailableReports(details: TTMovieDetails): { heading: string; label: string; categories: { tableLabel: string; category: string }[] }[] {
  return groupTables(details.tables).map((g) => ({
    heading: g.heading,
    label: headingLabel(g.heading),
    categories: g.tables.map((t) => ({ tableLabel: t.label, category: categoryLabel(t, g.heading) }))
  }));
}

export function buildPosterData(details: TTMovieDetails, tableLabel: string): BuildPosterResult {
  const table = details.tables.find((t) => t.label === tableLabel);
  if (!table) return { error: `"${tableLabel}" isn't one of ${details.title}'s tracked reports right now.` };
  if (table.rows.filter((r) => !r.__isTotal).length === 0) {
    return { error: `"${tableLabel}" has no rows yet -- nothing to post.` };
  }

  const groups = groupTables(details.tables);
  const group = groups.find((g) => g.tables.some((t) => t.label === tableLabel));
  const reportLine = group ? `${headingLabel(group.heading)} — ${categoryLabel(table, group.heading)}` : table.label;

  const data: PosterData = {
    movieTitle: details.title,
    reportLine,
    generatedDateText: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    updatedText: details.metaUpdatedText,
    badgeText: details.badgeText,
    summary: buildSummary(table),
    columns: table.headers,
    rows: table.rows.filter((r) => !r.__isTotal),
    posterImageUrl: posterToJpg(details.poster),
    sourceLabel: 'Source: TrackTollywood'
  };

  return { data, table };
}
