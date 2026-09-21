import { CalendarRange } from 'lucide-react';
import Link from 'next/link';
import { getLiveMovies, parseReleaseDate } from '@/lib/tracktollywood/scraper';
import { Card, IconBadge, SectionHeading, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function UpcomingPage() {
  let movies: Awaited<ReturnType<typeof getLiveMovies>> = [];
  let loadError: string | null = null;
  try {
    movies = await getLiveMovies();
  } catch (err: any) {
    loadError = err?.message ?? 'Could not reach TrackTollywood right now.';
  }
  // Advance = pre-release with advance bookings already open; Upcoming =
  // announced but bookings not open yet. Both belong here, not on
  // /now-showing, which is only movies actually released and running.
  const upcoming = movies
    .filter((m) => m.state === 'advance' || m.state === 'upcoming')
    .map((m) => ({ ...m, _date: parseReleaseDate(m.releaseText) }))
    .sort((a, b) => (a._date?.getTime() ?? Infinity) - (b._date?.getTime() ?? Infinity));

  return (
    <div className="px-5 md:px-10 py-8">
      <SectionHeading title="Upcoming releases" />

      {loadError ? (
        <EmptyState>Could not load right now ({loadError}). Try again shortly.</EmptyState>
      ) : upcoming.length === 0 ? (
        <EmptyState>No upcoming releases yet.</EmptyState>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {upcoming.map((u) => {
            const days = u._date ? Math.max(0, Math.ceil((u._date.getTime() - Date.now()) / 86400000)) : null;
            return (
              <Link key={u.slug} href={`/tracktollywood/${u.slug}`}>
                <Card className="p-5 h-full hover:-translate-y-0.5 transition">
                  <IconBadge icon={CalendarRange} tint="yellow" size={44} />
                  {days == null ? (
                    <div className="hdisplay text-lg gtext mt-3 mb-2">Coming soon</div>
                  ) : days > 0 ? (
                    <>
                      <div className="hdisplay text-3xl gtext mt-3">{days}</div>
                      <div className="text-xs text-textFaint mb-2">days to go</div>
                    </>
                  ) : (
                    <div className="hdisplay text-lg gtext mt-3 mb-2">Releasing today</div>
                  )}
                  <div className="text-sm font-medium">{u.title}</div>
                  <div className="text-xs text-textFaint">{u.releaseText ?? (u.genre || '')}</div>
                  {u.gross && <div className="text-xs text-goldBright font-semibold mt-1">{u.gross} advance</div>}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
