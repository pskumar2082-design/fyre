import type { Article, ArticleKind, Section } from './types';

// SAMPLE CONTENT for local development only (the file store). Every
// headline starts with "Sample:" and every body says it is not news, so a
// screenshot can never be mistaken for a real Fyre story. Never written to
// Supabase.

const BODY =
  '<p><strong>This is sample text for testing the Fyre newsroom layout. It is not news.</strong></p>' +
  '<p>Fyre editors write their own articles here. Each one has a category, a type label (Report, Analysis, Opinion or Explainer), its sources and, for politics, the name of the editor who checked the facts.</p>' +
  '<p>Quotes stay short and are attributed. Reporting based on another outlet names and links that outlet in the Sources box at the end of the article.</p>' +
  '<h2>How this page is built</h2><p>The headline, description, image credit and body come from the admin newsroom. The publish time and the last update time are shown separately.</p>';

let n = 0;
function a(now: Date, hoursAgo: number, section: Section, category: string, headline: string, description: string, kind: ArticleKind, extra: Partial<Article> = {}): Article {
  n += 1;
  const t = new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();
  const slug = `sample-${headline.toLowerCase().replace(/^sample:\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`;
  return {
    id: `sample-${n}`,
    section,
    category,
    slug,
    headline,
    description,
    bodyHtml: BODY,
    heroImageUrl: null,
    heroImageAlt: '',
    imageCredit: '',
    tags: [],
    sources: [],
    kind,
    status: 'published',
    publishAt: t,
    publishedAt: t,
    createdAt: t,
    updatedAt: t,
    author: 'Fyre Desk (sample)',
    featuredRank: null,
    factCheckedBy: null,
    factCheckedAt: null,
    seoTitle: '',
    seoDescription: '',
    correctionNote: null,
    isSample: true,
    ...extra
  };
}

const src = (name: string, url: string) => ({ name, url, checkedOn: '2026-11-01' });

export function sampleArticles(now: Date): Article[] {
  n = 0;
  return [
    a(now, 1, 'news', 'breaking', 'Sample: Lead story headline written by a Fyre editor', 'Sample description: one line that tells the reader what happened and why it matters.', 'report', { featuredRank: 1, tags: ['sample'] }),
    a(now, 2, 'news', 'telangana', 'Sample: Hyderabad metro extension plan explained', 'Sample description for a Telangana explainer, with its sources listed at the end.', 'explainer', {
      featuredRank: 2,
      sources: [src('Sample source: Government of Telangana', 'https://www.telangana.gov.in')]
    }),
    a(now, 3, 'news', 'entertainment', 'Sample: Weekend releases and what to watch', 'Sample description for an entertainment round-up.', 'report', { featuredRank: 3 }),
    a(now, 4, 'news', 'india', 'Sample: India squad named for the ODI series', 'Sample description for a cricket story tagged "cricket", shown on the Sports page too.', 'report', { tags: ['cricket'] }),
    a(now, 6, 'news', 'world', 'Sample: World news headline for layout testing', 'Sample description for a world story.', 'report'),
    a(now, 8, 'news', 'technology', 'Sample: What the new phone rules mean for users', 'Sample description for a technology explainer.', 'explainer'),
    a(now, 9, 'news', 'andhra-pradesh', 'Sample: Andhra Pradesh district news headline', 'Sample description for an Andhra Pradesh story.', 'report'),
    a(now, 10, 'news', 'india', 'Sample: IPL auction dates announced', 'Sample description for a second cricket story.', 'report', { tags: ['cricket', 'ipl'] }),
    a(now, 2.5, 'politics', 'andhra-pradesh', 'Sample: Assembly session to begin next week', 'Sample description for an Andhra Pradesh politics report with a checked source.', 'report', {
      sources: [src('Sample source: Andhra Pradesh Legislature', 'https://aplegislature.org')],
      factCheckedBy: 'Sample Editor',
      factCheckedAt: now.toISOString()
    }),
    a(now, 5, 'politics', 'elections', 'Sample: How the election schedule is set', 'Sample description for an elections explainer that links to the Election Commission.', 'explainer', {
      sources: [src('Sample source: Election Commission of India', 'https://eci.gov.in')],
      factCheckedBy: 'Sample Editor',
      factCheckedAt: now.toISOString()
    }),
    a(now, 7, 'politics', 'telangana', 'Sample: Telangana cabinet decisions this week', 'Sample description for a Telangana politics report.', 'report', {
      sources: [src('Sample source: Government of Telangana', 'https://www.telangana.gov.in')],
      factCheckedBy: 'Sample Editor',
      factCheckedAt: now.toISOString()
    }),
    a(now, 12, 'politics', 'policy', 'Sample: What a new bill would change', 'Sample description for an analysis piece, labelled Analysis.', 'analysis', {
      sources: [src('Sample source: PRS Legislative Research', 'https://prsindia.org')],
      factCheckedBy: 'Sample Editor',
      factCheckedAt: now.toISOString()
    }),
    a(now, -20, 'news', 'india', 'Sample: Scheduled story (not public yet)', 'Sample description for an article scheduled for tomorrow.', 'report', { status: 'scheduled', publishedAt: null }),
    a(now, 0, 'news', 'india', 'Sample: Draft story (not public)', 'Sample description for a draft.', 'report', { status: 'draft', publishAt: null, publishedAt: null })
  ];
}
