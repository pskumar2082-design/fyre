// Shared "which report is active" mode for a movie comparison -- pure,
// framework-free (no React, no 'use client') so it can be imported both
// by the interactive tab strip (components/compare/ComparisonTabs.tsx)
// and by the /compare page's server-side URL parsing (app/compare/page.tsx
// and its client orchestrator) without pulling a client-only module into
// a Server Component just to read a type/parse a query param.
import type { ComparedReportGroup } from './types';

export type ComparisonMode =
  | { kind: 'overview' }
  | { kind: 'collections' }
  | { kind: 'cumulative' }
  | { kind: 'day'; heading: string }
  | { kind: 'advance'; heading: string };

// The exact string stored in the /compare page's `?mode=` query param --
// e.g. "overview", "collections", "day:Day 2", "advance:Advance 2026-09-18".
export function modeKey(mode: ComparisonMode): string {
  return mode.kind === 'day' || mode.kind === 'advance' ? `${mode.kind}:${mode.heading}` : mode.kind;
}

// Reverse of modeKey(), validated against the report groups the CURRENT
// movie selection actually has -- a URL saved/shared while comparing one
// pair of movies (e.g. "day:Day 9") falls back to defaultMode() rather
// than rendering an empty tab when reopened against a different pair
// that never got to Day 9.
export function modeFromKey(key: string | undefined | null, groups: ComparedReportGroup[]): ComparisonMode {
  if (!key) return defaultMode(groups);
  if (key === 'overview' || key === 'collections' || key === 'cumulative') return { kind: key };
  const [kind, ...rest] = key.split(':');
  const heading = rest.join(':');
  if ((kind === 'day' || kind === 'advance') && groups.some((g) => g.heading === heading)) {
    return { kind, heading } as ComparisonMode;
  }
  return defaultMode(groups);
}

// Overview first, then whichever of Collections/Day-wise/Cumulative/
// Advance the current selection actually supports, in that reading
// order -- same fallback components/compare/ComparisonTabs.tsx always
// used, now shared so the page's initial render picks the same default
// tab the tab strip itself would.
export function defaultMode(groups: ComparedReportGroup[]): ComparisonMode {
  if (groups.some((g) => g.heading === 'Day-wise Collection')) return { kind: 'collections' };
  const firstDay = groups.find((g) => g.category === 'day');
  if (firstDay) return { kind: 'day', heading: firstDay.heading };
  if (groups.some((g) => g.heading === 'Cumulative')) return { kind: 'cumulative' };
  const firstAdvance = groups.find((g) => g.category === 'advance');
  if (firstAdvance) return { kind: 'advance', heading: firstAdvance.heading };
  return { kind: 'overview' };
}
