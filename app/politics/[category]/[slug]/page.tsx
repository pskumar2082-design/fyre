import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { newsroomEnabled } from '@/lib/v2/flags';
import { ArticlePage, articleMetadata } from '@/components/newsroom/SectionPages';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { category: string; slug: string } }): Promise<Metadata> {
  return newsroomEnabled() ? articleMetadata('politics', params.category, params.slug) : {};
}

export default async function PoliticsArticlePage({ params }: { params: { category: string; slug: string } }) {
  if (!newsroomEnabled()) notFound();
  return <ArticlePage section="politics" categorySlug={params.category} slug={params.slug} />;
}
