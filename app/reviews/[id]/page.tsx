import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

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
