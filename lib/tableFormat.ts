// Shared column-styling heuristics for any table rendered on the site --
// the TrackTollywood breakdown tables (components/TableGroups.tsx) and the
// hand-authored tables an admin embeds inside a news article or review
// (components/ArticleTable.tsx). Kept in one place so both look like the
// same design system rather than drifting apart, and deliberately mirrors
// the same four-way split (money / percent / occupancy / plain data) and
// occupancy thresholds already hardcoded in lib/poster/blocks.tsx for the
// Satori-rendered social poster -- same presentation rules, just Tailwind
// tokens here instead of raw hex (Satori can't consume Tailwind classes).
// Nothing here is a business-logic calculation, only how an existing
// number gets colored/aligned/pilled once it's already been computed.
export function isMoneyColumn(header: string): boolean {
  return /gross|collection|coll\./i.test(header);
}

// "Share %", a plain "%" header, or a day-over-day "Change" column --
// rendered as the poster's blue pill, not semantically colored (unlike
// occupancy below).
export function isPercentColumn(header: string): boolean {
  return header.trim() === '%' || /share/i.test(header);
}

// Occupancy gets its own bucket because -- unlike a share/change percent
// -- it's given a semantic red/amber/green color by occupancyColor()
// below rather than the neutral blue pill.
export function isOccupancyColumn(header: string): boolean {
  return /occupancy/i.test(header);
}

// Anything else genuinely numeric (tickets, shows, screens, change) --
// right-aligned tabular figures in the neutral dim tone, no pill or color.
export function isDataColumn(header: string): boolean {
  return /ticket|show|screen|change/i.test(header);
}

// Presentation-only occupancy color mapping -- same thresholds as
// lib/poster/blocks.tsx's occupancyColor() (<25% red, <55% amber, else
// green), returning a Tailwind text-color token instead of a hex value.
// Reused, not reinvented: this is the one occupancy-coloring rule that
// existed anywhere in the codebase before this design pass (the poster's
// own copy), now the shared source both the site and poster logic agree
// with in spirit -- never a business threshold, purely how an already-
// computed percentage gets colored.
export function occupancyColorClass(value: string): string {
  const n = Number(value.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return 'text-textDim';
  if (n < 25) return 'text-red';
  if (n < 55) return 'text-amber';
  return 'text-goldDim';
}
