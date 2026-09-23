import Link from 'next/link';
import Image from 'next/image';
import { Search, TrendingUp, Film, ListFilter, IndianRupee } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getLiveMovies, getCompletedMovies, getMovieDetails, parseReleaseDate, parseAmountToCr } from '@/lib/tracktollywood/scraper';
import { getDailyTotals } from '@/lib/tracktollywood/aggregate';
import { STATE_LABEL, STATE_BADGE } from '@/lib/tracktollywood/stateStyle';
import { Card, IconBadge, SectionHeading, EmptyState, Pill } from '@/components/ui';
import { Donut, TrendChart } from '@/components/charts';
import MovieCard from '@/components/MovieCard';

export const dynamic = 'force-dynamic';
// Belt-and-braces alongside force-dynamic above: without this, supabase-js's own
// fetch() calls can still get picked up by Next's Data Cache independently of
// the page's rendering mode, which is why newly-added news/reviews could take a
// while to show up on the homepage. This forces every fetch in this route
// segment -- including third-party ones like supabase-js's -- to always hit
// the network.
export const fetchCache = 'force-no-store';

async function getData() {
  const [{ data: news }, { data: reviews }, allMovies, completed, dailyTotals] = await Promise.all([
    supabase.from('news').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(3),
    getLiveMovies().catch(() => [] as Awaited<ReturnType<typeof getLiveMovies>>),
    getCompletedMovies().catch(() => [] as Awaited<ReturnType<typeof getCompletedMovies>>),
    getDailyTotals().catch(() => [] as Awaited<ReturnType<typeof getDailyTotals>>)
  ]);

  const nowShowing = allMovies.filter((m) => m.state === 'live');
  const upcoming = allMovies
    .filter((m) => m.state === 'advance' || m.state === 'upcoming')
    .map((m) => ({ ...m, _date: parseReleaseDate(m.releaseText) }))
    .sort((a, b) => (a._date?.getTime() ?? Infinity) - (b._date?.getTime() ?? Infinity));

  // The homepage's own Upcoming row shows each movie's full headline
  // figure (e.g. "₹24.18Cr — India Advance", the same number the
  // movie's own detail page leads with) rather than the lighter "Advance
  // Gross" figure the hub listing page carries (e.g. "₹18.61Cr") -- both
  // are genuinely different, correctly-scraped TrackTollywood metrics,
  // and the detail page's headline is the one the user wants surfaced
  // here. That means one extra fetch per card, so this only runs for the
  // ~10 movies actually shown in the row, in parallel, and falls back to
  // the hub listing's own gross/grossLabel for any movie whose detail
  // fetch fails -- a slower or broken detail page for one title should
  // never blank out its card.
  const upcomingPreview = upcoming.slice(0, 10);
  const upcomingRow = await Promise.all(
    upcomingPreview.map(async (m) => {
      try {
        const details = await getMovieDetails(m.slug);
        if (details?.headlineGross) {
          return { ...m, gross: details.headlineGross, grossLabel: details.headlineLabel ?? m.grossLabel };
        }
      } catch {
        // fall through to the hub-listing figure already on `m`
      }
      return m;
    })
  );

  // Today's aggregate gross -- summed live from each live movie's own
  // "today" figure (todayText), not from the snapshot table, so this is
  // always accurate to the minute rather than lagging a day behind.
  const todaysGrossCr = nowShowing.reduce((sum, m) => sum + (parseAmountToCr(m.todayText) ?? 0), 0);

  return {
    news: news ?? [],
    reviews: reviews ?? [],
    nowShowing,
    upcoming,
    upcomingRow,
    completed,
    completedCount: completed.length,
    todaysGrossCr,
    dailyTotals
  };
}

function formatCr(cr: number): string {
  if (cr <= 0) return '—';
  return cr >= 1 ? `₹${cr.toFixed(2)} Cr` : `₹${(cr * 100).toFixed(1)} L`;
}

export default async function HomePage() {
  const { news, reviews, nowShowing, upcoming, upcomingRow, completed, completedCount, todaysGrossCr, dailyTotals } = await getData();
  const liveTable = [...nowShowing].sort((a, b) => (b.grossCr ?? 0) - (a.grossCr ?? 0)).slice(0, 8);
  const boxOfficeRow = [...completed].sort((a, b) => (b.grossCr ?? 0) - (a.grossCr ?? 0)).slice(0, 8);

  return (
    <div className="px-5 md:px-8 py-8 flex flex-col lg:flex-row gap-6">
      {/* LEFT — the cream "Today's Statistics" column from the reference:
          today's real aggregate gross, a live count, and the real
          Live/Upcoming/Completed split as a donut. No "vs yesterday"
          comparison line on the two stat cards -- there's no persisted
          history to back that number honestly (see
          lib/tracktollywood/snapshot.ts for what now collects it going
          forward for the trend chart on the right). */}
      <aside className="order-2 lg:order-1 lg:w-[300px] flex-none bg-bgAlt -mx-5 px-5 pt-8 pb-8 md:-mx-8 md:px-8 mt-6 lg:mt-0 lg:mx-0 lg:px-5 lg:py-6 lg:rounded-2xl">
        <h2 className="hdisplay text-lg text-text mb-5">Live Snapshot</h2>

        <Card className="p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <IconBadge icon={IndianRupee} tint="blue" size={48} />
            <span className="text-[11px] font-semibold bg-white/[0.06] text-textDim px-2.5 py-1 rounded-full">Today</span>
          </div>
          <div className="text-textFaint text-xs mb-1">Today's Gross</div>
          <div className="font-stat font-bold text-5xl text-gold leading-none">{formatCr(todaysGrossCr)}</div>
          <div className="text-textFaint text-xs mt-2.5">across {nowShowing.length} movie{nowShowing.length === 1 ? '' : 's'} live right now</div>
        </Card>

        <Card className="p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <IconBadge icon={Film} tint="indigo" size={48} />
            <span className="text-[11px] font-semibold bg-white/[0.06] text-textDim px-2.5 py-1 rounded-full">Today</span>
          </div>
          <div className="text-textFaint text-xs mb-1">Live Now</div>
          <div className="font-stat font-bold text-5xl text-indigo leading-none">{nowShowing.length}</div>
          <div className="text-textFaint text-xs mt-2.5">{upcoming.length} upcoming · {completedCount} completed archive</div>
        </Card>

        {/* Live/Upcoming/Completed all read as one blue-adjacent family
            here (indigo / blue / faint-white) rather than the red-vs-green
            pairing this replaced -- red stays reserved for the actual
            live-tracking badges and pulse dots elsewhere in the app
            (see lib/tracktollywood/stateStyle.ts), not this summary. */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-text font-medium">Live vs Upcoming vs Completed</span>
            <span className="text-[11px] font-semibold bg-white/[0.06] text-textDim px-2.5 py-1 rounded-full">Today</span>
          </div>
          <Donut
            segments={[
              { label: 'Live', value: nowShowing.length, colorClass: 'text-indigo', dotClass: 'bg-indigo' },
              { label: 'Upcoming', value: upcoming.length, colorClass: 'text-gold', dotClass: 'bg-gold' },
              { label: 'Completed', value: completedCount, colorClass: 'text-textFaint', dotClass: 'bg-textFaint' }
            ]}
          />
        </Card>
      </aside>

      {/* RIGHT — the white main column. Order follows how users actually
          want to browse on mobile: what's new (News, Reviews) and what's
          coming (Upcoming) first, then what's playing right now (Now
          Showing) and the full completed archive (Box Office), with the
          Earning Summary trend chart last since it's the most
          data-dense/least glanceable block. */}
      <div className="flex-1 min-w-0 order-1 lg:order-2">
        <Card className="p-5 mb-6">
          <h2 className="hdisplay text-lg text-text mb-4">Find a movie</h2>
          <form action="/search" className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 bg-surface2 border border-border rounded-xl h-[50px] px-4 flex-1 min-w-[220px]">
              <Search size={18} className="text-textFaint flex-none" />
              <input
                type="text"
                name="q"
                placeholder="Movie title"
                className="bg-transparent outline-none text-sm text-text placeholder:text-textFaint w-full"
              />
            </div>
            <Pill href="/now-showing" variant="default" className="!h-[50px] !rounded-xl !px-5">
              <Film size={16} /> Now showing
            </Pill>
            <Pill href="/upcoming" variant="default" className="!h-[50px] !rounded-xl !px-5">
              <ListFilter size={16} /> Upcoming
            </Pill>
            <Pill type="submit" variant="primary" className="!h-[50px] !rounded-xl !px-8">
              Search
            </Pill>
          </form>
        </Card>

        {/* Existing content, kept above the dashboard tables and restyled light. */}
        {news.length > 0 && (
          <section className="mb-10">
            <SectionHeading title="Latest from the industry" action={<Link href="/news" className="text-gold text-xs font-semibold hover:underline">See all →</Link>} />
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {news.map((n: any) => (
                <Link key={n.id} href={`/news/${n.id}`} className="block group">
                  <Card className="overflow-hidden hover:-translate-y-0.5 transition">
                    {n.image_url && (
                      <div className="relative h-20 sm:h-36 w-full">
                        <Image src={n.image_url} alt="" fill className="object-cover object-top" />
                      </div>
                    )}
                    <div className="p-2.5 sm:p-4">
                      <h3 className="text-sm sm:text-base font-semibold mb-1 sm:mb-2 text-text group-hover:text-gold transition line-clamp-2">{n.title}</h3>
                      <p className="hidden sm:block text-sm text-textDim line-clamp-2">{n.excerpt}</p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {reviews.length > 0 && (
          <section className="mb-10">
            <SectionHeading title="Fresh reviews" action={<Link href="/reviews" className="text-gold text-xs font-semibold hover:underline">See all →</Link>} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {reviews.map((r: any) => (
                <Link key={r.id} href={`/reviews/${r.id}`} className="block group">
                  <Card className="p-5 hover:-translate-y-0.5 transition">
                    <div className="flex justify-between mb-2">
                      <span className="text-[#F6A609]">★★★★★</span>
                      <span className="bg-gold text-white text-sm font-bold px-2.5 py-1 rounded-lg">{r.rating} / 5</span>
                    </div>
                    <h3 className="font-semibold mb-2 text-text group-hover:text-gold transition">{r.title}</h3>
                    <p className="text-sm text-textDim line-clamp-3">{r.excerpt}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="hdisplay text-lg text-text">Upcoming</h2>
            <Link href="/upcoming" className="text-xs font-semibold text-gold hover:underline">See all →</Link>
          </div>
          {upcomingRow.length === 0 ? (
            <EmptyState>No upcoming releases yet.</EmptyState>
          ) : (
            <div className="flex items-start gap-4 overflow-x-auto -mx-1 px-1 pb-1">
              {upcomingRow.map((m) => (
                <MovieCard key={m.slug} movie={m} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="hdisplay text-lg text-text">Now showing</h2>
            <Link href="/now-showing" className="text-xs font-semibold text-gold hover:underline">See all →</Link>
          </div>
          {liveTable.length === 0 ? (
            <EmptyState>Nothing currently in theaters.</EmptyState>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm border-collapse min-w-[600px]">
                <thead>
                  <tr className="mdtype-overline text-textFaint border-b border-border">
                    <th className="text-left py-3 px-3 w-10">No.</th>
                    <th className="text-left py-3 px-3">Movie</th>
                    <th className="text-left py-3 px-3">Status</th>
                    <th className="text-right py-3 px-3">Gross</th>
                    <th className="text-right py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {liveTable.map((m, i) => (
                    <tr key={m.slug} className="border-b border-border last:border-0 hover:bg-white/[0.03] transition">
                      <td className="py-3 px-3 text-textFaint font-semibold">{String(i + 1).padStart(2, '0')}</td>
                      <td className="py-3 px-3">
                        <Link href={`/movie/${m.slug}`} className="flex items-center gap-3 group">
                          <div className="w-9 h-9 flex-none rounded-full overflow-hidden bg-surface2 border border-border relative">
                            {m.poster && <Image src={m.poster} alt="" fill unoptimized className="object-cover object-top" />}
                          </div>
                          <span className="font-medium text-text group-hover:text-gold transition truncate max-w-[220px]">{m.title}</span>
                        </Link>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase px-2.5 py-1 rounded-full ${
                          m.state === 'live' ? 'bg-red/10 text-red border border-red/20' : 'bg-white/[0.05] text-textFaint border border-white/[0.08]'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${m.state === 'live' ? 'bg-red' : 'bg-textFaint'}`} />
                          {STATE_LABEL[m.state]}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-stat font-bold text-base text-gold">{m.gross || '—'}</td>
                      <td className="py-3 px-3 text-right">
                        <Pill href={`/movie/${m.slug}`} variant="primary" className="!text-xs !px-4 !py-1.5">
                          Details
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="hdisplay text-lg text-text">Box office</h2>
            <Link href="/box-office" className="text-xs font-semibold text-gold hover:underline">See all →</Link>
          </div>
          {boxOfficeRow.length === 0 ? (
            <EmptyState>Nothing in the archive yet.</EmptyState>
          ) : (
            <div className="flex items-start gap-4 overflow-x-auto -mx-1 px-1 pb-1">
              {boxOfficeRow.map((m, i) => (
                <MovieCard key={m.slug} movie={m} rank={i + 1} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 mb-10">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="hdisplay text-lg text-text">Earning Summary</h2>
            <span className="flex items-center gap-1.5 text-xs text-textDim">
              <TrendingUp size={14} className="text-gold" /> Daily total gross across every tracked movie
            </span>
          </div>
          {dailyTotals.length < 2 ? (
            <EmptyState>
              Collecting daily data now — a daily snapshot job saves today's totals going forward, so this trend
              fills in over the next few days instead of showing invented history.
            </EmptyState>
          ) : (
            <TrendChart points={dailyTotals.map((d) => ({ date: d.date, value: Math.round(d.totalCr * 100) / 100 }))} />
          )}
        </Card>
      </div>
    </div>
  );
}
