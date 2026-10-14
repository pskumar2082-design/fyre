import Link from 'next/link';
import Image from 'next/image';
import type { TTListedMovie } from '@/lib/boxoffice/types';
import { STATE_LABEL, STATE_BADGE } from '@/lib/boxoffice/stateStyle';

// Portrait poster card (reference: "Trending Now" cards) -- 2:3 poster,
// 12px radius, 1px zinc-800 border, monospace badges on a black scrim:
// state top-left (a rank, when given, leads the title), the amber headline figure top-right. Title
// and mono meta line below. Used on every movie rail and grid.
export const CARD_WIDTH = 'w-[clamp(140px,13.77vw,300px)]';

export default function MovieCard({ movie, rank, className = CARD_WIDTH }: { movie: TTListedMovie; rank?: number; className?: string }) {
  const state = STATE_LABEL[movie.state];
  const meta = [movie.dayLabel, movie.grossLabel].filter(Boolean).join(' · ') || movie.releaseText || movie.genre;
  return (
    <Link href={`/movie/${movie.slug}`} role="listitem" className={`group flex-none snap-start ${className}`}>
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface2 border border-border transition duration-300 group-hover:border-borderStrong group-hover:-translate-y-1 group-hover:shadow-lift">
        {movie.poster ? (
          <Image src={movie.poster} alt="" fill unoptimized sizes="300px" className="object-cover transition duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-textFaint">No poster</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
        <span className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex items-center gap-1.5">
          {state && (
            <span className={`inline-flex items-center gap-1.5 font-mono font-bold uppercase tracking-wider text-[10px] sm:text-[11px] 2xl:text-[13px] leading-none px-1.5 sm:px-2 py-1.5 rounded-md ${STATE_BADGE[movie.state]}`}>
              {movie.state === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              {state}
            </span>
          )}
        </span>
        {movie.gross && (
          // Amber figure badge only where the card is wide enough to hold both
          // badges side by side (>=176px cards from xl); below that the same
          // figure is already in the mono meta line under the title.
          <span className="hidden xl:inline-block absolute top-2.5 right-2.5 2xl:top-3 2xl:right-3 font-mono font-bold text-[11px] 2xl:text-[13px] leading-none text-gold bg-black/80 px-2 py-1.5 rounded-md">
            {movie.gross}
          </span>
        )}
      </div>
      <div className="mt-3 px-0.5">
        <div className="text-[15px] sm:text-base font-semibold tracking-tight text-text truncate">
          {rank != null && <span className="font-mono font-bold text-textFaint mr-1.5">{rank}</span>}
          {movie.title}
        </div>
        {meta && <div className="font-mono text-[11px] sm:text-xs text-textFaint mt-1 truncate">{meta}</div>}
      </div>
    </Link>
  );
}
