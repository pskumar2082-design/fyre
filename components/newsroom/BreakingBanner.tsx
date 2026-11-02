import Link from 'next/link';
import { currentBanner } from '@/lib/newsroom/public';
import { fyreV2 } from '@/lib/v2/flags';
import { istTime } from '@/lib/sports/derive';

// Site-wide breaking-news strip. One active banner at a time, set in the
// admin newsroom with an end time; it disappears on its own when it ends.
export default async function BreakingBanner() {
  if (!fyreV2()) return null;
  const b = await currentBanner();
  if (!b) return null;
  const inner = (
    <>
      <span className="flex-none font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider bg-red text-white rounded px-2 py-1">Breaking</span>
      <span className="min-w-0 truncate text-sm sm:text-[15px] font-semibold text-text">{b.text}</span>
      <span className="flex-none ml-auto font-mono text-xs text-textDim hidden sm:inline">{istTime(b.startsAt)} IST</span>
    </>
  );
  return (
    <div className="border-b border-red/40 bg-red/10">
      <div className="fx-container py-2.5">
        {b.link ? (
          <Link href={b.link} className="flex items-center gap-3 hover:opacity-90">
            {inner}
          </Link>
        ) : (
          <div className="flex items-center gap-3">{inner}</div>
        )}
      </div>
    </div>
  );
}
