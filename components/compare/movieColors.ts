// Shared per-movie identity (color only -- name/poster come from the
// movie itself) for every place the comparison UI shows more than one
// movie side by side at once: the merged table's per-movie sort buttons,
// the stat cards' per-movie value rows, the chart's bars, and the
// MovieLegend. One small file so a given movie's color can never drift
// between components on the same page.
//
// Four calibrated design-system tokens (tailwind.config.js) already
// distinguishable from each other and from the site's semantic red/
// amber/green occupancy colors, capped at 4 because the comparison
// feature never supports more than 4 movies at once (see lib/compare/
// types.ts). Index wraps via `% 4` purely as a defensive fallback --
// callers should never actually pass an index >= movies.length <= 4.
const HEX = ['#38BDF8', '#22C55E', '#FBBF24', '#A78BFA'] as const; // sky, green, amber, violet
const DOT_CLASS = ['bg-sky', 'bg-goldDim', 'bg-gold', 'bg-violet'] as const;
const TEXT_CLASS = ['text-sky', 'text-goldDim', 'text-gold', 'text-violet'] as const;
const BORDER_CLASS = ['border-sky', 'border-goldDim', 'border-gold', 'border-violet'] as const;

export function movieColorHex(index: number): string {
  return HEX[index % HEX.length];
}

export function movieDotClass(index: number): string {
  return DOT_CLASS[index % DOT_CLASS.length];
}

export function movieTextClass(index: number): string {
  return TEXT_CLASS[index % TEXT_CLASS.length];
}

export function movieBorderClass(index: number): string {
  return BORDER_CLASS[index % BORDER_CLASS.length];
}
