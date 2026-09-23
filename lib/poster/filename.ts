// "fyre-the-paradise-advance-2026-09-24-state-wise.png" -- lowercase,
// alphanumeric-and-dash only, so it's safe as a filename on every OS and
// reads cleanly as a Twitter/X attachment name.
function slugPiece(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildPosterFilename(movieSlug: string, tableLabel: string): string {
  const piece = slugPiece(tableLabel);
  return `fyre-${slugPiece(movieSlug)}${piece ? `-${piece}` : ''}.png`;
}

// "fyre-compare-the-paradise-vs-akhanda-2-day-wise-collection.png" -- same
// filename conventions as buildPosterFilename, extended to N movie slugs
// joined by "-vs-" for the comparison poster
// (app/api/social-poster/compare/route.ts).
export function buildComparisonPosterFilename(movieSlugs: string[], reportLine: string): string {
  const piece = slugPiece(reportLine);
  const movies = movieSlugs.map(slugPiece).join('-vs-');
  return `fyre-compare-${movies}${piece ? `-${piece}` : ''}.png`;
}
