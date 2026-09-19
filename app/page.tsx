import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import MovieCard from '@/components/MovieCard';
import { isInTheaters, titleWithYear } from '@/lib/movieStatus';

export const revalidate = 30; // re-fetch from Supabase at most every 30s

async function getData() {
  const [{ data: news }, { data: reviews }, { data: liveBoxOffice }, { data: nowShowingRaw }, { data: upcoming }] =
    await Promise.all([
      supabase.from('news').select('*').order('created_at', { ascending: false }).limit(12),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(9),
      supabase.from('live_box_office').select('*').order('created_at', { ascending: false }).limit(10),
      // Fetched unlimited (well past what any "in theaters" set will ever
      // hold) and filtered below to movies still within their theatrical
      // window -- a plain .limit() here could easily cut off before we'd
      // even gotten to the still-running ones once the table has a few
      // months of history in it.
      supabase.from('now_showing').select('*').order('release_date', { ascending: false }).limit(200),
      supabase.from('upcoming').select('*').order('release_date', { ascending: true }).limit(8)
    ]);
  const nowShowing = (nowShowingRaw ?? []).filter((m: any) => isInTheaters(m)).slice(0, 10);
  return {
    news: news ?? [],
    reviews: reviews ?? [],
    liveBoxOffice: liveBoxOffice ?? [],
    nowShowing,
    upcoming: upcoming ?? []
  };
}

export default async function HomePage() {
  const { news, reviews, liveBoxOffice, nowShowing, upcoming } = await getData();
  const featured = nowShowing[0];

  return (
    <div>
      {/* HERO — left-aligned headline + feature row, featured movie card on
          the right, in the moviemintbo.com layout (our own colors). */}
      <section className="relative overflow-hidden pt-14 pb-12 px-5">
        <div className="glow-spot w-[520px] h-[520px] bg-gold/20 -top-56 -left-20" />
        <div className="glow-spot w-[360px] h-[360px] bg-brandPink/12 top-0 right-0" />
        <div className="max-w-6xl mx-auto relative grid md:grid-cols-[1.15fr_1fr] gap-10 md:gap-14 items-center">
          <div>
            <h1 className="hdisplay text-4xl md:text-5xl lg:text-6xl mb-4">
              Lights. Camera.
              <span className="gtext"> fyre.</span>
            </h1>
            <p className="text-textDim text-sm md:text-base max-w-md mb-8">
              We track real-time advance bookings and box office collections across every major market. News, reviews and everything cinema — decoded.
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-4">
              <FeatureItem
                label="Live Tracking"
                icon={
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </>
                }
              />
              <FeatureItem
                label="Daily Sync"
                icon={
                  <>
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                    <path d="M21 3v6h-6" />
                  </>
                }
              />
              <FeatureItem
                label="State-wise Data"
                icon={
                  <>
                    <path d="M4 19V9" />
                    <path d="M12 19V5" />
                    <path d="M20 19v-7" />
                  </>
                }
              />
            </div>
          </div>

          {featured && (
            <Link
              href={`/now-showing/${featured.id}`}
              className="relative block rounded-2xl bg-surface border border-border overflow-hidden hover:border-gold transition group"
            >
              <div className="relative h-72 w-full">
                {featured.image_url && (
                  <Image
                    src={featured.image_url}
                    alt=""
                    fill
                    className="object-cover object-top transition duration-300 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />
                <span className="absolute top-3 right-3 bg-gold text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg">
                  Featured
                </span>
              </div>
              <div className="p-4">
                <div className="hdisplay text-xl">{titleWithYear(featured.title, featured.release_date)}</div>
                <div className="text-textFaint text-xs mt-1">
                  {[featured.release_date, featured.language].filter(Boolean).join(' · ')}
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-xs text-goldBright font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-goldBright" />
                  Live tracking active
                </div>
              </div>
            </Link>
          )}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-5">
        {/* NOW SHOWING (tap a poster to open its full box-office breakdown page) */}
        <section id="boxoffice" className="mt-6">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              <h2 className="hdisplay text-2xl">Now showing</h2>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <Link href="/now-showing" className="text-goldBright hover:underline">See all in theaters →</Link>
              <Link href="/box-office" className="text-textDim hover:text-goldBright transition">Full box office archive →</Link>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3">
            {nowShowing.length === 0 && (
              <p className="text-textFaint text-sm">No entries yet — add some from the admin panel.</p>
            )}
            {nowShowing.map((m: any, i: number) => (
              <MovieCard key={m.id} movie={m} rank={i + 1} />
            ))}
          </div>
        </section>

        {/* NEWS */}
        <section id="news" className="mt-16">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              <h2 className="hdisplay text-2xl">Latest from the industry</h2>
            </div>
            <Link href="/news" className="text-goldBright text-xs font-semibold hover:underline">See all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {news.length === 0 && <p className="text-textFaint text-sm">No stories yet.</p>}
            {news.map((n: any) => (
              <Link
                key={n.id}
                href={`/news/${n.id}`}
                className="block bg-surface border border-border rounded-2xl overflow-hidden hover:border-gold hover:-translate-y-0.5 transition"
              >
                {n.image_url && (
                  <div className="relative h-40 w-full">
                    <Image src={n.image_url} alt="" fill className="object-cover object-top" />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold mb-2">{n.title}</h3>
                  <p className="text-sm text-textDim line-clamp-3">{n.excerpt}</p>
                  <div className="text-xs text-textFaint mt-3 pt-3 border-t border-border">{n.date}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* REVIEWS */}
        <section id="reviews" className="mt-16">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              <h2 className="hdisplay text-2xl">Fresh reviews</h2>
            </div>
            <Link href="/reviews" className="text-goldBright text-xs font-semibold hover:underline">See all →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {reviews.length === 0 && <p className="text-textFaint text-sm">No reviews yet.</p>}
            {reviews.map((r: any) => (
              <Link
                key={r.id}
                href={`/reviews/${r.id}`}
                className="block bg-surface border border-border rounded-2xl p-5 hover:border-gold hover:-translate-y-0.5 transition"
              >
                <div className="flex justify-between mb-2">
                  <span className="text-goldBright">★★★★★</span>
                  <span className="bg-gold text-white text-sm font-bold px-2.5 py-1 rounded-lg">
                    {r.rating} / 5
                  </span>
                </div>
                <h3 className="font-semibold mb-2">{r.title}</h3>
                <p className="text-sm text-textDim line-clamp-3">{r.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* UPCOMING */}
        <section id="upcoming" className="mt-16 pb-16">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              <h2 className="hdisplay text-2xl">Upcoming releases</h2>
            </div>
            <Link href="/upcoming" className="text-goldBright text-xs font-semibold hover:underline">See all →</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3">
            {upcoming.length === 0 && <p className="text-textFaint text-sm">No upcoming releases yet.</p>}
            {upcoming.map((u: any) => {
              const days = Math.max(
                0,
                Math.ceil((new Date(u.release_date).getTime() - Date.now()) / 86400000)
              );
              return (
                <div key={u.id} className="flex-none w-44 bg-surface border border-border rounded-2xl p-4">
                  <div className="hdisplay text-3xl gtext">{days}</div>
                  <div className="text-xs text-textFaint mb-2">days to go</div>
                  <div className="text-sm font-medium">{u.title}</div>
                  <div className="text-xs text-textFaint">{u.release_date}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function FeatureItem({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-textDim">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-goldBright">
        {icon}
      </svg>
      {label}
    </div>
  );
}
