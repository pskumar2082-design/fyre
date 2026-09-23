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
