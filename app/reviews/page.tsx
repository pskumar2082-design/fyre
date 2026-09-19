import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

export default async function ReviewsPage() {
  const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(200);
  const reviews = data ?? [];

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <h1 className="hdisplay text-3xl mb-8">Fresh reviews</h1>

      {reviews.length === 0 && <p className="text-textFaint text-sm">No reviews yet.</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {reviews.map((r: any) => (
          <Link
            key={r.id}
            href={`/reviews/${r.id}`}
            className="block bg-surface border border-border rounded-2xl p-5 hover:border-gold hover:-translate-y-0.5 transition"
          >
            <div className="flex justify-between mb-2">
              <span className="text-goldBright">★★★★★</span>
              <span className="bg-gold text-white text-sm font-bold px-2.5 py-1 rounded-lg">{r.rating} / 5</span>
            </div>
            <h3 className="font-semibold mb-2">{r.title}</h3>
            <p className="text-sm text-textDim line-clamp-3">{r.excerpt}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
