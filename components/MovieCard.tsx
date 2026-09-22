import Link from 'next/link';
import Image from 'next/image';
import type { TTListedMovie } from '@/lib/tracktollywood/types';
import { STATE_LABEL, STATE_BADGE } from '@/lib/tracktollywood/stateStyle';

// The poster card used for a TrackTollywood movie everywhere one appears --
// the homepage's featured carousel, /now-showing, and /upcoming -- so all
// three stay visually identical and only need to change in one place.
// Links to /tracktollywood/[slug], the shared detail page every one of
// those sections points at.
export default function MovieCard({ movie, rank }: { movie: TTListedMovie; rank?: number }) {
  const badgeLabel = movie.dayLabel ? `${STATE_LABEL[movie.state]} · ${movie.dayLabel}` : STATE_LABEL[movie.state];
  return (
    <Link href={`/tracktollywood/${movie.slug}`} className="flex-none w-40 group">
      <div className="w-40 h-56 rounded-2xl bg-surface2 border border-black/[0.04] shadow-card relative overflow-hidden flex items-end p-2.5 transition group-hover:border-gold/30">
        {movie.poster ? (
          <Image
            src={movie.poster}
            alt=""
            fill
            unoptimized
            className="object-cover object-top transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-textFaint text-[11px]">No poster</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        {rank != null && (
          <span className="absolute top-2.5 left-2.5 text-[11px] font-bold bg-black/70 backdrop-blur border border-white/10 text-white px-2 py-1 rounded-lg">
            #{rank}
          </span>
        )}
        {badgeLabel && (
          <span
            className={`relative inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg ${STATE_BADGE[movie.state]}`}
          >
            {movie.state === 'live' && (
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-white/60 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-white" />
              </span>
            )}
            {badgeLabel}
          </span>
        )}
      </div>
      <div className="text-sm font-medium mt-2.5 truncate text-text group-hover:text-gold transition">{movie.title}</div>
      {movie.gross && (
        <div className="mt-0.5">
          <div className="text-sm font-stat font-bold text-gold leading-tight">{movie.gross}</div>
          {movie.grossLabel && <div className="text-[10px] text-textFaint uppercase tracking-wide">{movie.grossLabel}</div>}
        </div>
      )}
    </Link>
  );
}
