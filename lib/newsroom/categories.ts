import type { Category, Section } from './types';

// The starting categories. Editors can rename them, reorder them, hide them
// or add new ones in the admin newsroom; a slug is fixed once an article uses
// it, so URLs never break.
export const DEFAULT_CATEGORIES: Category[] = [
  { section: 'news', slug: 'breaking', name: 'Breaking News', description: 'Developing stories as they happen.', sort: 1, active: true },
  { section: 'news', slug: 'india', name: 'India', description: 'News from across India.', sort: 2, active: true },
  { section: 'news', slug: 'world', name: 'World', description: 'International news.', sort: 3, active: true },
  { section: 'news', slug: 'andhra-pradesh', name: 'Andhra Pradesh', description: 'News from Andhra Pradesh.', sort: 4, active: true },
  { section: 'news', slug: 'telangana', name: 'Telangana', description: 'News from Telangana.', sort: 5, active: true },
  { section: 'news', slug: 'entertainment', name: 'Entertainment', description: 'Films, OTT, music and celebrities.', sort: 6, active: true },
  { section: 'news', slug: 'technology', name: 'Technology', description: 'Technology news.', sort: 7, active: true },
  { section: 'politics', slug: 'india', name: 'Indian Politics', description: 'National politics and Parliament.', sort: 1, active: true },
  { section: 'politics', slug: 'andhra-pradesh', name: 'Andhra Pradesh Politics', description: 'Politics in Andhra Pradesh.', sort: 2, active: true },
  { section: 'politics', slug: 'telangana', name: 'Telangana Politics', description: 'Politics in Telangana.', sort: 3, active: true },
  { section: 'politics', slug: 'elections', name: 'Elections', description: 'Elections, schedules and official results.', sort: 4, active: true },
  { section: 'politics', slug: 'government', name: 'Government Announcements', description: 'Official announcements from the Centre and the states.', sort: 5, active: true },
  { section: 'politics', slug: 'policy', name: 'Policies and Legislation', description: 'Bills, Acts and policy decisions.', sort: 6, active: true }
];

export const SECTION_LABEL: Record<Section, string> = { news: 'Latest News', politics: 'Politics' };

export const KIND_LABEL = { report: 'Report', analysis: 'Analysis', opinion: 'Opinion', explainer: 'Explainer' } as const;

export function isSection(v: string): v is Section {
  return v === 'news' || v === 'politics';
}

export function articlePath(a: { section: Section; category: string; slug: string }): string {
  return `/${a.section}/${a.category}/${a.slug}`;
}
