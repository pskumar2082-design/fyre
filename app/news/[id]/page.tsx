import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabaseClient';
import { SITE_URL } from '@/lib/siteConfig';
import { stripTables } from '@/lib/articleTable';
import ArticleBody from '@/components/ArticleBody';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

// Per-article <title>/description/Open Graph card -- without this, every
// shared news link fell back to the site-wide homepage title/description
// (and, before the root layout got a fallback image, no image at all),
// so a link pasted into X/WhatsApp/etc. couldn't tell one article's card
// apart from another's or from the homepage's.
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { data: n, error } = await supabase.from('news').select('*').eq('id', params.id).single();
  if (!n) {
    if (error) console.error('generateMetadata(news): failed to fetch article from Supabase', params.id, error);
    return {};
  }

  const description = (n.excerpt || stripTables(n.content || '')).slice(0, 200);
  const url = `${SITE_URL}/news/${params.id}`;

  return {
    title: n.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: n.title,
      description,
      images: n.image_url ? [{ url: n.image_url }] : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title: n.title,
      description,
      images: n.image_url ? [n.image_url] : undefined
    }
  };
}

export default async function NewsDetailPage({ params }: { params: { id: string } }) {
  const { data: n, error } = await supabase.from('news').select('*').eq('id', params.id).single();
  if (!n) {
    if (error) console.error('NewsDetailPage: failed to fetch article from Supabase', params.id, error);
    return notFound();
  }

  const bodyText = n.content || n.excerpt || '';
  const words = bodyText.trim().split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(words / 200));

  return (
    <div className="px-5 md:px-10 py-8 max-w-3xl">
      <Link href="/" className="inline-flex items-center gap-1.5 text-gold text-sm font-semibold">
        <ArrowLeft size={15} /> Back to fyre
      </Link>

      <div className="mt-6 rounded-2xl shadow-card card-gradient-primary p-8">
        <span className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded mb-4">
          {n.category || 'Movie news'}
        </span>
        <h1 className="hdisplay text-white text-3xl md:text-4xl max-w-xl">{n.title}</h1>
      </div>

      {n.image_url && (
        <div className="relative w-full h-72 mt-6 rounded-2xl shadow-card overflow-hidden">
          <Image src={n.image_url} alt="" fill className="object-cover object-top" />
        </div>
      )}

      <div className="text-textFaint text-sm mt-6 pb-5 border-b border-border">
        {n.date} &nbsp;·&nbsp; {readMins} min read
      </div>

      <div className="mt-6 text-[16px] leading-[1.85] max-w-[66ch] text-text">
        <ArticleBody content={bodyText} />
      </div>
    </div>
  );
}
