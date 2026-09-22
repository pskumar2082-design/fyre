// Shared column-styling heuristics for any table rendered on the site --
// the TrackTollywood breakdown tables (components/TableGroups.tsx) and the
// hand-authored tables an admin embeds inside a news article or review
// (components/ArticleTable.tsx). Kept in one place so both look like the
// same design system rather than drifting apart: a "Gross"/"Collection"
// column always gets the bold gold money treatment, and anything else
// genuinely numeric (tickets, shows, occupancy, share, %) gets right-aligned
// tabular figures.
export function isMoneyColumn(header: string): boolean {
  return /gross|collection|coll\./i.test(header);
}

export function isDataColumn(header: string): boolean {
  return /ticket|show|screen|occupancy|share|change|%/i.test(header);
}
