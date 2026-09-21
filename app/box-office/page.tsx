import Link from 'next/link';
import Image from 'next/image';
import { getCompletedMovies } from '@/lib/tracktollywood/scraper';
import { Card, SectionHeading, EmptyState, Pill } from '@/components/ui';

export const dynamic = 'force-dynamic';

type SortKey = 'gross' | 'az';

export default async function BoxOfficePage({ searchParams }: { searchParams: { sort?: string } }) {
  let movies: Awaited<ReturnType<typeof getCompletedMovies>> = [];
  let loadError: string | null = null;
  try {
    movies = await getCompletedMovies();
  } catch (err: any) {
    loadError = err?.message ?? 'Could not reach TrackTollywood right now.';
  }

  const sort: SortKey = searchParams.sort === 'az' ? 'az' : 'gross';
  const sorted = [...movies].sort((a, b) =>
    sort === 'az' ? a.title.localeCompare(b.title) : (b.grossCr ?? 0) - (a.grossCr ?? 0)
  );

  return (
    <div className="px-5 md:px-10 py-8">
      <SectionHeading
        title="Box office archive"
        action={<Link href="/now-showing" className="text-gold text-sm font-semibold hover:underline">See what&rsquo;s in theaters now →</Link>}
      />
      <p className="text-textFaint text-sm mb-6 -mt-3">
        Final collection reports for movies that have completed their theatrical run.
      </p>

      <div className="flex items-center gap-2 mb-6">
        <Pill href="/box-office?sort=gross" variant={sort === 'gross' ? 'active' : 'default'} className="!px-4 !py-1.5 !text-xs">
          Highest gross
        </Pill>
        <Pill href="/box-office?sort=az" variant={sort === 'az' ? 'active' : 'default'} className="!px-4 !py-1.5 !text-xs">
          A – Z
        </Pill>
        <span className="text-textFaint text-xs ml-auto">{sorted.length} movies</span>
      </div>

      {loadError ? (
        <EmptyState>Could not load right now ({loadError}). Try again shortly.</EmptyState>
      ) : sorted.length === 0 ? (
        <EmptyState>Nothing in the archive yet.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[720px]">
            <thead>
              <tr className="text-textFaint text-[11px] uppercase tracking-wide border-b border-white/10 bg-white/[0.03]">
                <th className="text-left py-4 px-5 w-12">#</th>
                <th className="text-left py-4 px-5">Movie</th>
                <th className="text-left py-4 px-5">Genre</th>
                <th className="text-left py-4 px-5">Run</th>
                <th className="text-right py-4 px-5">Collection</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, i) => (
                <tr key={m.slug} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition">
                  <td className="py-3 px-5 text-textFaint font-semibold">{i + 1}</td>
                  <td className="py-3 px-5">
                    <Link href={`/tracktollywood/${m.slug}`} className="flex items-center gap-3 group">
                      <div className="w-10 h-14 flex-none rounded-lg overflow-hidden bg-surface2 border border-white/5 relative">
                        {m.poster && <Image src={m.poster} alt="" fill unoptimized className="object-cover object-top" />}
                      </div>
                      <span className="font-medium text-text group-hover:text-gold transition">{m.title}</span>
                    </Link>
                  </td>
                  <td className="py-3 px-5 text-textDim">{m.genre || '—'}</td>
                  <td className="py-3 px-5">
                    <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {m.dayLabel ? `Final · ${m.dayLabel}` : 'Completed run'}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right font-stat text-lg text-text">{m.gross || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
