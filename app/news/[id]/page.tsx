import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

export default async function NewsDetailPage({ params }: { params: { id: string } }) {
  const { data: n } = await supabase.from('news').select('*').eq('id', params.id).single();
  if (!n) return notFound();

  const body = (n.content || n.excerpt || '').split(/\n\s*\n/).filter(Boolean);
  const words = (n.content || n.excerpt || '').trim().split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(words / 200));

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <Link href="/" className="text-goldBright text-sm font-semibold">
        ← Back to fyre
      </Link>

      <div className="mt-6 bg-gradient-to-br from-[#241244] to-[#0A0614] border border-border rounded-2xl p-8">
        <span className="inline-block bg-gold text-white text-xs font-bold px-3 py-1 rounded mb-4">
          {n.category || 'Movie news'}
        </span>
        <h1 className="hdisplay text-white text-3xl md:text-4xl max-w-xl">{n.title}</h1>
      </div>

      {n.image_url && (
        <div className="relative w-full h-72 mt-6 rounded-2xl overflow-hidden">
          <Image src={n.image_url} alt="" fill className="object-cover object-top" />
        </div>
      )}

      <div className="text-textFaint text-sm mt-6 pb-5 border-b border-border">
        {n.date} &nbsp;·&nbsp; {readMins} min read
      </div>

      <div className="mt-6 text-[16px] leading-[1.85] max-w-[66ch]">
        {body.map((p: string, i: number) => (
          <p key={i} className="mb-5">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
