import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { newsroomEnabled } from '@/lib/v2/flags';
import { SectionIndex, sectionMetadata, pageParam } from '@/components/newsroom/SectionPages';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { category: string } }): Promise<Metadata> {
  return newsroomEnabled() ? sectionMetadata('politics', params.category) : {};
}

export default async function PoliticsCategoryPage({ params, searchParams }: { params: { category: string }; searchParams?: { page?: string } }) {
  if (!newsroomEnabled()) notFound();
  return <SectionIndex section="politics" categorySlug={params.category} page={pageParam(searchParams?.page)} />;
}
