import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabaseClient';
import { SITE_URL } from '@/lib/siteConfig';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

// Per-review <title>/description/Open Graph card -- see the matching
// comment in app/news/[id]/page.tsx for why this was missing and why it
// matters for shared links.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { data: r } = await supabase.from('reviews').select('*').eq('id', params.id).single();
  if (!r) return {};

  const description = (r.excerpt || r.content || '').slice(0, 200);
  const url = `${SITE_URL}/reviews/${params.id}`;
  const title = `${r.title} — ${r.rating}/5 Review`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title,
      description,
      images: r.image_url ? [{ url: r.image_url }] : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: r.image_url ? [r.image_url] : undefined
    }
  };
}

export default async function ReviewDetailPage({ params }: { params: { id: string } }) {
  const { data: r } = await supabase.from('reviews').select('*').eq('id', params.id).single();
  if (!r) return notFound();

  const body = (r.content || r.excerpt || '').split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="px-5 md:px-10 py-8 max-w-3xl">
      <Link href="/" className="inline-flex items-center gap-1.5 text-gold text-sm font-semibold">
        <ArrowLeft size={15} /> Back to fyre
      </Link>

      <div className="mt-6 rounded-2xl shadow-card card-gradient-primary p-8">
        <span className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded mb-4">
          {r.rating} / 5
        </span>
        <h1 className="hdisplay text-white text-3xl md:text-4xl max-w-xl">{r.title}</h1>
      </div>

      {r.image_url && (
        <div className="relative w-full h-72 mt-6 rounded-2xl shadow-card overflow-hidden">
          <Image src={r.image_url} alt="" fill className="object-cover object-top" />
        </div>
      )}

      <div className="text-textFaint text-sm mt-6 pb-5 border-b border-border">{r.date}</div>

      <div className="mt-6 text-[16px] leading-[1.85] max-w-[66ch] text-text">
        {body.map((p: string, i: number) => (
          <p key={i} className="mb-5">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
