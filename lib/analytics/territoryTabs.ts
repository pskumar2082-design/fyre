import type { MovieAnalytics } from './types';

export type Tab = 'overview' | 'india' | 'usa';

// Movie-page territory tabs follow the data a Fyre movie has -- never an
// empty territory tab:
//   India + USA -> [ Overview ] [ India ] [ USA ]   (opens on Overview)
//   India only  -> [ Overview ] [ India ]            (opens on India)
//   USA only    -> [ Overview ] [ USA ]              (opens on USA)
export function territoryTabs(india: MovieAnalytics | null, usa: MovieAnalytics | null): { tabs: Tab[]; initial: Tab } {
  const tabs: Tab[] = ['overview', ...(india ? (['india'] as Tab[]) : []), ...(usa ? (['usa'] as Tab[]) : [])];
  const initial: Tab = india && usa ? 'overview' : india ? 'india' : usa ? 'usa' : 'overview';
  return { tabs, initial };
}
