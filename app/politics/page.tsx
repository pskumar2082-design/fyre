import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { newsroomEnabled } from '@/lib/v2/flags';
import { SectionIndex, sectionMetadata, pageParam } from '@/components/newsroom/SectionPages';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return newsroomEnabled() ? sectionMetadata('politics') : {};
}

export default async function PoliticsPage({ searchParams }: { searchParams?: { page?: string } }) {
  if (!newsroomEnabled()) notFound();
  return <SectionIndex section="politics" page={pageParam(searchParams?.page)} />;
}
