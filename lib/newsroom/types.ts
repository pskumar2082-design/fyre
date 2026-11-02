// Fyre newsroom: articles written and published by Fyre's own editors.
// No external news feed is involved.

export type Section = 'news' | 'politics';
export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'unpublished';
export type ArticleKind = 'report' | 'analysis' | 'opinion' | 'explainer';

export interface SourceRef {
  name: string; // outlet or official body, e.g. "Election Commission of India"
  url: string;
  checkedOn: string; // YYYY-MM-DD, when an editor checked it
}

export interface Category {
  section: Section;
  slug: string; // URL segment; fixed once articles use it
  name: string;
  description: string;
  sort: number;
  active: boolean;
}

export interface Article {
  id: string;
  section: Section;
  category: string; // category slug within the section
  slug: string; // headline slug, unique per section
  headline: string;
  description: string;
  bodyHtml: string; // sanitized rich text
  heroImageUrl: string | null;
  heroImageAlt: string;
  imageCredit: string;
  tags: string[];
  sources: SourceRef[];
  kind: ArticleKind;
  status: ArticleStatus;
  publishAt: string | null; // when it goes (or went) public
  publishedAt: string | null; // first time it went public
  createdAt: string;
  updatedAt: string;
  author: string | null;
  featuredRank: number | null; // 1..5 on the homepage, null = not featured
  factCheckedBy: string | null;
  factCheckedAt: string | null;
  seoTitle: string;
  seoDescription: string;
  correctionNote: string | null;
  isSample?: boolean; // local sample content only; never stored in Supabase
}

export type ArticleInput = Omit<Article, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'status' | 'publishAt'> & {
  id?: string;
};

export interface Revision {
  id: string;
  articleId: string;
  editedBy: string | null;
  editedAt: string;
  note: string;
  snapshot: Article;
}

export interface BreakingBanner {
  id: string;
  text: string;
  link: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
  createdBy: string | null;
  updatedAt: string;
}

export interface HomeSection {
  key: 'headlines' | 'cricket' | 'now_showing' | 'box_office' | 'politics' | 'trending';
  label: string;
  enabled: boolean;
  sort: number;
}

export const DEFAULT_HOME_SECTIONS: HomeSection[] = [
  { key: 'headlines', label: 'Latest Headlines', enabled: true, sort: 1 },
  { key: 'cricket', label: 'Live Cricket Scores', enabled: true, sort: 2 },
  { key: 'now_showing', label: 'Now Showing Telugu Movies', enabled: true, sort: 3 },
  { key: 'box_office', label: 'Box Office Collections', enabled: true, sort: 4 },
  { key: 'politics', label: 'Political Updates', enabled: true, sort: 5 },
  { key: 'trending', label: 'Trending Stories', enabled: true, sort: 6 }
];
