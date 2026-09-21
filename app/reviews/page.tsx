import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Card, SectionHeading, EmptyState } from '@/components/ui';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

export default async function ReviewsPage() {
  const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(200);
  const reviews = data ?? [];

  return (
    <div className="px-5 md:px-10 py-8">
      <SectionHeading title="Fresh reviews" />

      {reviews.length === 0 ? (
        <EmptyState>No reviews yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {reviews.map((r: any) => (
            <Link key={r.id} href={`/reviews/${r.id}`} className="block group">
              <Card className="p-5 hover:-translate-y-0.5 transition">
                <div className="flex justify-between mb-2">
                  <span className="text-[#F6A609]">★★★★★</span>
                  <span className="bg-gold text-white text-sm font-bold px-2.5 py-1 rounded-lg">{r.rating} / 5</span>
                </div>
                <h3 className="font-semibold mb-2 group-hover:text-gold transition">{r.title}</h3>
                <p className="text-sm text-textDim line-clamp-3">{r.excerpt}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
