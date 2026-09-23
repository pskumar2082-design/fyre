// The exact /compare?a=..&b=..&c=..&d=.. query-param names for each movie
// "slot", shared by the server page's initial searchParams parsing
// (app/compare/page.tsx) and the client orchestrator's URL-sync effect
// (app/compare/ComparePageClient.tsx) so the two can never drift apart
// and silently break shareable comparison links.
export const SLUG_PARAMS = ['a', 'b', 'c', 'd'] as const;
export const MAX_COMPARE_MOVIES = SLUG_PARAMS.length;
