import { supabase } from '@/lib/supabaseClient';
import { SectionHeading, EmptyState } from '@/components/ui';
import ReviewCard from '@/components/ReviewCard';

import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteConfig';

export const metadata: Metadata = {
  title: 'Telugu Movie Reviews',
  description: 'Fresh reviews and ratings for the latest Telugu movie releases.',
  alternates: { canonical: `${SITE_URL}/reviews` }
};

export const revalidate = 30; // re-fetch from Supabase at most every 30s

export default async function ReviewsPage() {
  const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(200);
  if (error) console.error('ReviewsPage: failed to fetch reviews list from Supabase', error);
  const reviews = data ?? [];

  return (
    <div className="px-5 md:px-10 py-8">
      <SectionHeading title="Fresh reviews" />

      {reviews.length === 0 ? (
        <EmptyState>No reviews yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {reviews.map((r: any) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </div>
  );
}
