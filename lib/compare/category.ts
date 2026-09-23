// Preferred sub-category order within a report group (e.g. "State-wise"
// before "Time Slots") -- shared by the /compare page's own category
// picker (components/compare/ComparisonGroupView.tsx) and the comparison
// poster builder (lib/poster/buildComparison.ts) so both default to the
// same breakdown for a report that has more than one, and by
// components/TableGroups.tsx's own single-movie CATEGORY_ORDER in spirit
// (same preferred reading order, kept as its own copy there since that
// file predates this feature and already had its own local one).
const CATEGORY_ORDER = ['state-wise', 'top cities', 'city-wise', 'language-wise', 'format-wise', 'time slots'];

export function pickDefaultCategory(categories: { category: string }[]): string {
  if (categories.length === 0) return '';
  for (const preferred of CATEGORY_ORDER) {
    const hit = categories.find((c) => c.category.toLowerCase() === preferred);
    if (hit) return hit.category;
  }
  return categories[0].category;
}
