import Link from 'next/link';
import Image from 'next/image';
import { getLiveMovies } from '@/lib/tracktollywood/scraper';
import { Card, SectionHeading, EmptyState } from '@/components/ui';

// Not DB-backed -- this scrapes TrackTollywood live (cached 5 min, see
// lib/tracktollywood/cache.ts) on every request, so there's nothing here
// for Next.js's own data cache to serve stale; force-dynamic keeps this
// page from being statically frozen at build time.
export const dynamic = 'force-dynamic';

const STATE_LABEL: Record<string, string> = {
  live: 'Live',
  advance: 'Advance',
  upcoming: 'Upcoming',
  final: 'Final',
  unknown: ''
};

const STATE_TINT: Record<string, string> = {
  live: 'bg-tintTeal text-chartTeal',
  advance: 'bg-tintBlue text-gold',
  upcoming: 'bg-tintYellow text-[#F6A609]',
  final: 'bg-tintPink text-coral',
  unknown: 'bg-tintBlue text-gold'
};

export default async function TrackTollywoodPage() {
  let movies: Awaited<ReturnType<typeof getLiveMovies>> = [];
  let loadError: string | null = null;
  try {
    movies = await getLiveMovies();
  } catch (err: any) {
    loadError = err?.message ?? 'Could not reach TrackTollywood right now.';
  }

  return (
    <div className="px-5 md:px-10 py-8">
      <SectionHeading title="TrackTollywood" />
      <p className="text-textFaint text-sm mb-8 -mt-3">
        Live box office tracking pulled directly from TrackTollywood -- day-wise, city-wise, state-wise, language-wise
        and format-wise breakdowns. Click a movie for the full report.{' '}
        <span className="italic">Data sourced from TrackTollywood.</span>
      </p>

      {loadError ? (
        <EmptyState>Could not load TrackTollywood right now ({loadError}). Try again shortly.</EmptyState>
      ) : movies.length === 0 ? (
        <EmptyState>TrackTollywood has no movies listed right now.</EmptyState>
      ) : (
        <div className="flex flex-wrap gap-4">
          {movies.map((m) => (
            <Link key={m.slug} href={`/tracktollywood/${m.slug}`} className="block w-[160px]">
              <Card className="overflow-hidden h-full">
                <div className="relative w-full aspect-[2/3] bg-tintBlue">
                  {m.poster ? (
                    <Image src={m.poster} alt={m.title} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-textFaint text-xs px-2 text-center">
                      No poster
                    </div>
                  )}
                  <span
                    className={`absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${STATE_TINT[m.state]}`}
                  >
                    {STATE_LABEL[m.state]}
                    {m.dayLabel ? ` · ${m.dayLabel}` : ''}
                  </span>
                </div>
                <div className="p-3">
                  <div className="font-semibold text-sm leading-tight line-clamp-2">{m.title}</div>
                  {m.genre && <div className="text-textFaint text-xs mt-1 line-clamp-1">{m.genre}</div>}
                  {m.gross && (
                    <div className="mt-2">
                      <div className="text-gold font-bold text-sm">{m.gross}</div>
                      {m.grossLabel && <div className="text-textFaint text-[10px] uppercase">{m.grossLabel}</div>}
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
