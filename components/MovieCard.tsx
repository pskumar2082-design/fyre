import Link from 'next/link';
import Image from 'next/image';
import type { TTListedMovie } from '@/lib/tracktollywood/types';

const STATE_LABEL: Record<string, string> = {
  live: 'Live',
  advance: 'Advance',
  upcoming: 'Upcoming',
  final: 'Final',
  unknown: ''
};

// The poster card used for a TrackTollywood movie everywhere one appears --
// the homepage's featured carousel, /now-showing, /upcoming, and
// /box-office -- so all four stay visually identical and only need to
// change in one place. Links to /tracktollywood/[slug], the shared detail
// page every one of those sections points at.
export default function MovieCard({ movie, rank }: { movie: TTListedMovie; rank?: number }) {
  const badge = movie.dayLabel ? `${STATE_LABEL[movie.state]} · ${movie.dayLabel}` : STATE_LABEL[movie.state];
  return (
    <Link href={`/tracktollywood/${movie.slug}`} className="flex-none w-40 group">
      <div className="w-40 h-56 rounded-2xl bg-surface2 shadow-card relative overflow-hidden flex items-end p-2.5">
        {movie.poster && (
          <Image
            src={movie.poster}
            alt=""
            fill
            unoptimized
            className="object-cover object-top transition duration-300 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {rank != null && (
          <span className="absolute top-2.5 left-2.5 text-[11px] font-bold bg-white/90 backdrop-blur text-text px-2 py-1 rounded-lg">
            #{rank}
          </span>
        )}
        {badge && (
          <span className="relative text-xs font-bold bg-gold text-white px-2 py-1 rounded-lg">{badge}</span>
        )}
      </div>
      <div className="text-sm font-medium mt-2.5 truncate group-hover:text-gold transition">{movie.title}</div>
      {movie.gross && <div className="text-xs text-goldBright font-semibold mt-0.5">{movie.gross}</div>}
    </Link>
  );
}
