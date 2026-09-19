import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import MovieCard from '@/components/MovieCard';
import { isInTheaters } from '@/lib/movieStatus';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

export default async function NowShowingPage() {
  // Fetched unlimited and filtered here rather than relying on a query
  // limit -- see app/page.tsx for why a plain .limit() risks cutting off
  // before reaching the still-running movies once the table has months of
  // history sitting in it.
  const { data } = await supabase.from('now_showing').select('*').order('release_date', { ascending: false }).limit(500);
  const movies = (data ?? []).filter((m: any) => isInTheaters(m));

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h1 className="hdisplay text-3xl">Now showing</h1>
        <Link href="/box-office" className="text-goldBright text-sm font-semibold hover:underline">
          Full box office archive →
        </Link>
      </div>
      <p className="text-textFaint text-sm mb-8">
        Every movie fyre is tracking that's still within its theatrical run. A movie moves to the box office
        archive once its run winds down, but its full collection history stays there.
      </p>

      {movies.length === 0 && (
        <p className="text-textFaint text-sm">Nothing currently in theaters — add one from the admin panel.</p>
      )}

      <div className="flex flex-wrap gap-4">
        {movies.map((m: any, i: number) => (
          <MovieCard key={m.id} movie={m} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
