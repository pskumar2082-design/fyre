import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { newsroomEnabled } from '@/lib/v2/flags';
import { ArticlePage, articleMetadata } from '@/components/newsroom/SectionPages';

export const revalidate = 300;

// /news/<category>/<slug>: a Fyre newsroom article.
export async function generateMetadata({ params }: { params: { key: string; slug: string } }): Promise<Metadata> {
  return newsroomEnabled() ? articleMetadata('news', params.key, params.slug) : {};
}

export default async function NewsArticlePage({ params }: { params: { key: string; slug: string } }) {
  if (!newsroomEnabled()) notFound();
  return <ArticlePage section="news" categorySlug={params.key} slug={params.slug} />;
}
