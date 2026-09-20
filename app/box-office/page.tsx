import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import { Card, SectionHeading, EmptyState } from '@/components/ui';
import { collectionCr, isInTheaters, titleWithYear } from '@/lib/movieStatus';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

export default async function BoxOfficePage() {
  const { data } = await supabase.from('now_showing').select('*').limit(1000);
  const movies = (data ?? [])
    .map((m: any) => ({ ...m, _cr: collectionCr(m) }))
    .sort((a: any, b: any) => b._cr - a._cr);

  return (
    <div className="px-5 md:px-10 py-8">
      <SectionHeading
        title="Box office archive"
        action={<Link href="/now-showing" className="text-gold text-sm font-semibold hover:underline">See what&rsquo;s in theaters now →</Link>}
      />
      <p className="text-textFaint text-sm mb-8 -mt-3">
        Every movie fyre has ever tracked, ranked by collections — movies still running are marked
        &ldquo;In theaters&rdquo;, everything else has completed its theatrical run.
      </p>

      {movies.length === 0 ? (
        <EmptyState>Nothing tracked yet.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[720px]">
            <thead>
              <tr className="text-textFaint text-xs uppercase border-b border-border bg-bgAlt/60">
                <th className="text-left py-4 px-5 w-12">#</th>
                <th className="text-left py-4 px-5">Movie</th>
                <th className="text-left py-4 px-5">Language / Genre</th>
                <th className="text-left py-4 px-5">Status</th>
                <th className="text-right py-4 px-5">Collection</th>
              </tr>
            </thead>
            <tbody>
              {movies.map((m: any, i: number) => {
                const active = isInTheaters(m);
                return (
                  <tr key={m.id} className="border-b border-[#F2F4F7] last:border-0 hover:bg-bg/60 transition">
                    <td className="py-3 px-5 text-textFaint font-semibold">{i + 1}</td>
                    <td className="py-3 px-5">
                      <Link href={`/now-showing/${m.id}`} className="flex items-center gap-3 group">
                        <div className="w-10 h-14 flex-none rounded-lg overflow-hidden bg-surface2 relative">
                          {m.image_url && <Image src={m.image_url} alt="" fill className="object-cover object-top" />}
                        </div>
                        <span className="font-medium group-hover:text-gold transition">
                          {titleWithYear(m.title, m.release_date)}
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 px-5 text-textDim">{[m.language, m.genre].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="py-3 px-5">
                      <span
                        className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                          active ? 'bg-tintBlue text-gold' : 'bg-bgAlt text-textFaint'
                        }`}
                      >
                        {active ? 'In theaters' : 'Completed run'}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-semibold text-gold">
                      {m.total_worldwide || m.lifetime_gross || m.amt || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
