import Link from 'next/link';
import Image from 'next/image';
import { Film, TrendingUp, CalendarRange, Star, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import MovieCard from '@/components/MovieCard';
import { Card, StatCard, SectionHeading, EmptyState } from '@/components/ui';
import { isInTheaters, titleWithYear, collectionCr } from '@/lib/movieStatus';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

async function getData() {
  // live_box_office used to back the "top live" stat card, but nothing
  // has written to it since Sacnilk was discontinued (2026-09) -- it's
  // permanently empty now regardless of how current the MovieMint sync
  // is. Fixed 2026-09-21: derive "top live" from now_showing itself
  // (MovieMint's own collection figures), the same source every other
  // stat/card on this page already uses.
  const [{ data: news }, { data: reviews }, { data: nowShowingRaw }, { data: upcoming }] =
    await Promise.all([
      supabase.from('news').select('*').order('created_at', { ascending: false }).limit(12),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(9),
      // Fetched unlimited (well past what any "in theaters" set will ever
      // hold) and filtered below to movies still within their theatrical
      // window -- a plain .limit() here could easily cut off before we'd
      // even gotten to the still-running ones once the table has a few
      // months of history in it.
      supabase.from('now_showing').select('*').order('release_date', { ascending: false }).limit(200),
      supabase.from('upcoming').select('*').order('release_date', { ascending: true }).limit(8)
    ]);
  const nowShowingActive = (nowShowingRaw ?? []).filter((m: any) => isInTheaters(m));
  // Ranked across every currently-showing movie, not just the 10 shown in
  // the carousel below -- the top earner overall might not be among the
  // most recently released.
  const topLive =
    [...nowShowingActive].filter((m: any) => collectionCr(m) > 0).sort((a: any, b: any) => collectionCr(b) - collectionCr(a))[0] ?? null;
  return {
    news: news ?? [],
    reviews: reviews ?? [],
    nowShowing: nowShowingActive.slice(0, 10),
    topLive,
    upcoming: upcoming ?? []
  };
}

export default async function HomePage() {
  const { news, reviews, nowShowing, topLive, upcoming } = await getData();
  const featured = nowShowing[0];
  const nearestUpcoming = upcoming[0] ?? null;
  const nearestDays = nearestUpcoming
    ? Math.max(0, Math.ceil((new Date(nearestUpcoming.release_date).getTime() - Date.now()) / 86400000))
    : null;
  const latestReview = reviews[0] ?? null;

  return (
    <div className="px-5 md:px-10 py-8">
      {/* STAT ROW — BankDash's "Main Dashboard" stat-card band, driven by
          real site data instead of static copy. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard icon={Film} tint="blue" label="In theaters" value={nowShowing.length} />
        <StatCard
          icon={TrendingUp}
          tint="teal"
          label={topLive ? topLive.title : 'No live tracking yet'}
          value={topLive ? `₹${collectionCr(topLive).toFixed(1)} Cr` : '—'}
        />
        <StatCard
          icon={CalendarRange}
          tint="yellow"
          label={nearestUpcoming ? nearestUpcoming.title : 'No upcoming releases'}
          value={nearestDays == null ? '—' : nearestDays === 0 ? 'Releasing today' : `${nearestDays}d to go`}
        />
        <StatCard
          icon={Star}
          tint="pink"
          label={latestReview ? latestReview.title : 'No reviews yet'}
          value={latestReview ? `${latestReview.rating} / 5` : '—'}
        />
      </div>

      {/* FEATURED — BankDash's gradient "bank card" widget, repurposed as a
          featured-movie banner. */}
      {featured && (
        <Link
          href={`/now-showing/${featured.id}`}
          className="relative block rounded-2xl shadow-card overflow-hidden mb-10 card-gradient-primary group"
        >
          <div className="relative flex flex-col md:flex-row items-stretch min-h-[220px]">
            <div className="flex-1 p-8 flex flex-col justify-center">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/80 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-white" /> Featured &amp; tracked live
              </span>
              <h1 className="hdisplay text-3xl md:text-4xl text-white mb-2">
                {titleWithYear(featured.title, featured.release_date)}
              </h1>
              <p className="text-white/70 text-sm max-w-md mb-4">
                {[featured.language, featured.genre].filter(Boolean).join(' · ') ||
                  'Live advance bookings and box office collections, tracked daily.'}
              </p>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                View full breakdown <ArrowRight size={15} />
              </span>
            </div>
            {featured.image_url && (
              <div className="relative w-full md:w-[280px] h-[220px] flex-none">
                <Image
                  src={featured.image_url}
                  alt=""
                  fill
                  className="object-cover object-top transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0A06F4] md:from-transparent via-transparent to-transparent" />
              </div>
            )}
          </div>
        </Link>
      )}

      {/* NOW SHOWING */}
      <section id="boxoffice" className="mb-12">
        <SectionHeading
          title="Now showing"
          action={
            <div className="flex items-center gap-4 text-xs font-semibold">
              <Link href="/now-showing" className="text-gold hover:underline">See all in theaters →</Link>
              <Link href="/box-office" className="text-textDim hover:text-gold transition">Full box office archive →</Link>
            </div>
          }
        />
        {nowShowing.length === 0 ? (
          <EmptyState>No entries yet — add some from the admin panel.</EmptyState>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-3">
            {nowShowing.map((m: any, i: number) => (
              <MovieCard key={m.id} movie={m} rank={i + 1} />
            ))}
          </div>
        )}
      </section>

      {/* NEWS */}
      <section id="news" className="mb-12">
        <SectionHeading title="Latest from the industry" action={<Link href="/news" className="text-gold text-xs font-semibold hover:underline">See all →</Link>} />
        {news.length === 0 ? (
          <EmptyState>No stories yet.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {news.map((n: any) => (
              <Link key={n.id} href={`/news/${n.id}`} className="block group">
                <Card className="overflow-hidden hover:-translate-y-0.5 transition">
                  {n.image_url && (
                    <div className="relative h-40 w-full">
                      <Image src={n.image_url} alt="" fill className="object-cover object-top" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold mb-2 group-hover:text-gold transition">{n.title}</h3>
                    <p className="text-sm text-textDim line-clamp-3">{n.excerpt}</p>
                    <div className="text-xs text-textFaint mt-3 pt-3 border-t border-border">{n.date}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* REVIEWS */}
      <section id="reviews" className="mb-12">
        <SectionHeading title="Fresh reviews" action={<Link href="/reviews" className="text-gold text-xs font-semibold hover:underline">See all →</Link>} />
        {reviews.length === 0 ? (
          <EmptyState>No reviews yet.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {reviews.map((r: any) => (
              <Link key={r.id} href={`/reviews/${r.id}`} className="block group">
                <Card className="p-5 hover:-translate-y-0.5 transition">
                  <div className="flex justify-between mb-2">
                    <span className="text-[#F6A609]">★★★★★</span>
                    <span className="bg-gold text-white text-sm font-bold px-2.5 py-1 rounded-lg">{r.rating} / 5</span>
                  </div>
                  <h3 className="font-semibold mb-2 group-hover:text-gold transition">{r.title}</h3>
                  <p className="text-sm text-textDim line-clamp-3">{r.excerpt}</p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* UPCOMING */}
      <section id="upcoming" className="mb-6">
        <SectionHeading title="Upcoming releases" action={<Link href="/upcoming" className="text-gold text-xs font-semibold hover:underline">See all →</Link>} />
        {upcoming.length === 0 ? (
          <EmptyState>No upcoming releases yet.</EmptyState>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-3">
            {upcoming.map((u: any) => {
              const days = Math.max(0, Math.ceil((new Date(u.release_date).getTime() - Date.now()) / 86400000));
              return (
                <Card key={u.id} className="flex-none w-44 p-4">
                  {days > 0 ? (
                    <>
                      <div className="hdisplay text-3xl gtext">{days}</div>
                      <div className="text-xs text-textFaint mb-2">days to go</div>
                    </>
                  ) : (
                    <div className="hdisplay text-lg gtext mb-2">Releasing today</div>
                  )}
                  <div className="text-sm font-medium">{u.title}</div>
                  <div className="text-xs text-textFaint">{u.release_date}</div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
