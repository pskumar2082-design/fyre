import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { Card, SectionHeading, EmptyState } from '@/components/ui';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

export default async function NewsPage() {
  const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false }).limit(200);
  const news = data ?? [];

  return (
    <div className="px-5 md:px-10 py-8">
      <SectionHeading title="Latest from the industry" />

      {news.length === 0 ? (
        <EmptyState>No stories yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {news.map((n: any) => (
            <Link key={n.id} href={`/news/${n.id}`} className="block group">
              <Card className="overflow-hidden hover:-translate-y-0.5 transition">
                {n.image_url && (
                  <div className="relative h-40 w-full">
                    <Image src={n.image_url} alt="" fill className="object-cover object-top" />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold mb-2 group-hover:text-gold transition">{n.title}</h3>
                  <p className="text-sm text-textDim line-clamp-3">{n.excerpt}</p>
                  <div className="text-xs text-textFaint mt-3 pt-3 border-t border-border">{n.date}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
