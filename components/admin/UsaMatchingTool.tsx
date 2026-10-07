'use client';

import ListingMatchingTool from './ListingMatchingTool';

// Admin → USA matching (BFILMY USA listings). See ListingMatchingTool.
export default function UsaMatchingTool() {
  return <ListingMatchingTool territory="usa" />;
}
