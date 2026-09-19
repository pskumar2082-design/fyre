import Link from 'next/link';
import Image from 'next/image';
import { titleWithYear } from '@/lib/movieStatus';

// The poster card used for a now_showing movie everywhere one appears --
// the homepage's featured carousel, the full /now-showing list, and the
// /box-office leaderboard -- so all three stay visually identical and only
// need to change in one place.
export default function MovieCard({
  movie,
  rank,
  badge
}: {
  movie: { id: string; title: string; release_date?: string | null; image_url?: string | null; status?: string | null; amt?: string | null };
  rank?: number;
  badge?: string | null;
}) {
  return (
    <Link href={`/now-showing/${movie.id}`} className="flex-none w-40 group">
      <div className="w-40 h-56 rounded-2xl bg-surface2 border border-border relative overflow-hidden flex items-end p-2.5 group-hover:border-gold transition">
        {movie.image_url && (
          <Image src={movie.image_url} alt="" fill className="object-cover object-top transition duration-300 group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {rank != null && (
          <span className="absolute top-2.5 left-2.5 text-[11px] font-bold bg-bg/80 backdrop-blur text-textDim px-2 py-1 rounded-lg">
            #{rank}
          </span>
        )}
        {(movie.status || badge) && (
          <span className="relative text-xs font-bold bg-gold text-white px-2 py-1 rounded-lg">{movie.status || badge}</span>
        )}
      </div>
      <div className="text-sm font-medium mt-2.5 truncate">{titleWithYear(movie.title, movie.release_date)}</div>
      {movie.amt && <div className="text-xs text-goldBright font-semibold mt-0.5">{movie.amt}</div>}
    </Link>
  );
}
