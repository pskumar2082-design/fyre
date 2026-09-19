import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { collectionCr, isInTheaters, titleWithYear } from '@/lib/movieStatus';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

export default async function BoxOfficePage() {
  const { data } = await supabase.from('now_showing').select('*').limit(1000);
  const movies = (data ?? [])
    .map((m: any) => ({ ...m, _cr: collectionCr(m) }))
    .sort((a: any, b: any) => b._cr - a._cr);

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h1 className="hdisplay text-3xl">Box office archive</h1>
        <Link href="/now-showing" className="text-goldBright text-sm font-semibold hover:underline">
          See what's in theaters now →
        </Link>
      </div>
      <p className="text-textFaint text-sm mb-8">
        Every movie fyre has ever tracked, ranked by collections — movies still running are marked
        &ldquo;In theaters&rdquo;, everything else has completed its theatrical run.
      </p>

      {movies.length === 0 && <p className="text-textFaint text-sm">Nothing tracked yet.</p>}

      <div className="flex flex-col gap-2.5">
        {movies.map((m: any, i: number) => {
          const active = isInTheaters(m);
          return (
            <Link
              key={m.id}
              href={`/now-showing/${m.id}`}
              className="flex items-center gap-4 bg-surface border border-border rounded-2xl p-3 hover:border-gold transition"
            >
              <span className="w-7 flex-none text-center text-textFaint text-sm font-bold">{i + 1}</span>
              <div className="w-12 h-16 flex-none rounded-lg overflow-hidden bg-surface2 border border-border relative">
                {m.image_url && <Image src={m.image_url} alt="" fill className="object-cover object-top" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{titleWithYear(m.title, m.release_date)}</div>
                <div className="text-xs text-textFaint mt-0.5">
                  {[m.language, m.genre].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex-none text-right">
                <div className="text-sm font-semibold text-goldBright">
                  {m.total_worldwide || m.lifetime_gross || m.amt || '—'}
                </div>
                <span
                  className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full mt-1 ${
                    active ? 'bg-goldDim/15 text-goldBright border border-gold/30' : 'bg-surface2 text-textFaint border border-border'
                  }`}
                >
                  {active ? 'In theaters' : 'Completed run'}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
