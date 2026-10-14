import Link from 'next/link';
import Image from 'next/image';
import { ChartNoAxesColumnIncreasing, GitCompareArrows } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getLiveMovies, getCompletedMovies, getMovieDetails, parseReleaseDate } from '@/lib/bfilmy/source';
import { STATE_LABEL } from '@/lib/boxoffice/stateStyle';
import type { TTListedMovie } from '@/lib/boxoffice/types';
import { SectionHeading, ViewAll } from '@/components/ui';
import MovieCard from '@/components/MovieCard';
import Rail from '@/components/Rail';
import ReviewCard from '@/components/ReviewCard';
import HomeCompareSection from '@/components/compare/HomeCompareSection';

export const dynamic = 'force-dynamic';
// Belt-and-braces alongside force-dynamic above: without this, supabase-js's own
// fetch() calls can still get picked up by Next's Data Cache independently of
// the page's rendering mode, which is why newly-added news/reviews could take a
// while to show up on the homepage. This forces every fetch in this route
// segment -- including third-party ones like supabase-js's -- to always hit
// the network.
export const fetchCache = 'force-no-store';

async function getData() {
  const [{ data: news }, { data: reviews }, allMovies, completed] = await Promise.all([
    supabase.from('news').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('reviews').select('*').order('created_at', { ascending: false }).limit(3),
    getLiveMovies().catch(() => [] as Awaited<ReturnType<typeof getLiveMovies>>),
    getCompletedMovies().catch(() => [] as Awaited<ReturnType<typeof getCompletedMovies>>)
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
        const details = await getMovieDetails(m.slug, 'summary');
        if (details?.headlineGross) {
          return { ...m, gross: details.headlineGross, grossLabel: details.headlineLabel ?? m.grossLabel };
        }
      } catch {
        // fall through to the hub-listing figure already on `m`
      }
      return m;
    })
  );

  return {
    news: news ?? [],
    reviews: reviews ?? [],
    nowShowing,
    upcoming,
    upcomingRow,
    completed
  };
}

// Cinematic hero (reference: homepage "FEATURED FILM" hero) for the
// day's top live movie: full-bleed backdrop under strong black gradients,
// mono badge + amber headline figure, oversized title, mono meta line,
// a Fyre box-office summary, and two real actions (box office, compare).
function Hero({ movie }: { movie: TTListedMovie }) {
  const year = movie.releaseText?.match(/(20\d{2})/)?.[1] ?? null;
  const meta = [year, movie.genre, movie.dayLabel].filter(Boolean);
  const summary = [
    movie.gross ? `${movie.grossLabel ?? 'Tracked gross'} ${movie.gross}${movie.dayLabel ? ` after ${movie.dayLabel.replace(/^Day /, '')} days` : ''}.` : null,
    movie.todayText ? `Today so far: ${movie.todayText}.` : null,
    movie.releaseText ? `${movie.releaseText}.` : null,
    'Day-wise collections, India and USA, state and city breakdowns, updated through the day.'
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <section className="relative isolate overflow-hidden border-b border-surface2">
      {movie.poster && (
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-y-0 right-0 w-full lg:w-[72%]">
            <Image src={movie.poster} alt="" fill unoptimized priority sizes="72vw" className="object-cover object-[50%_25%] opacity-75" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 lg:via-black/60 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/50" />
        </div>
      )}
      <div className="fx-container pt-16 pb-14 sm:pt-28 sm:pb-[72px] 2xl:pt-[170px] 2xl:pb-[72px] min-h-[420px] sm:min-h-[520px] 2xl:min-h-[609px] flex flex-col justify-end">
        <div className="flex items-center gap-3 mb-5 sm:mb-6">
          <span className={`inline-flex items-center gap-2 font-mono font-bold uppercase tracking-wider text-xs sm:text-[15px] leading-none px-3 py-2 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-white`}>
            {movie.state === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red animate-pulse" />}
            {movie.state === 'live' ? 'Now showing' : STATE_LABEL[movie.state] || 'Featured'}
          </span>
          {movie.gross && <span className="font-mono font-bold text-sm sm:text-lg text-gold">{movie.gross}</span>}
        </div>
        <h1 className="type-xl-headline text-5xl sm:text-6xl 2xl:text-[76px] text-white max-w-4xl">{movie.title}</h1>
        {meta.length > 0 && <div className="font-mono text-sm sm:text-xl text-zinc-300 mt-4 sm:mt-6">{meta.join(' • ')}</div>}
        <p className="text-base sm:text-xl leading-relaxed text-zinc-300 mt-4 sm:mt-5 max-w-[830px] line-clamp-3">{summary}</p>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-7 sm:mt-10">
          <Link
            href={`/movie/${movie.slug}`}
            className="inline-flex items-center gap-2.5 h-12 sm:h-14 px-6 sm:px-8 rounded-lg bg-white text-black text-base sm:text-xl font-bold hover:bg-zinc-200 transition-colors"
          >
            <ChartNoAxesColumnIncreasing className="w-5 h-5 sm:w-[22px] sm:h-[22px]" strokeWidth={2.5} />
            Box Office
          </Link>
          <Link
            href={`/compare?movies=${encodeURIComponent(movie.slug)}`}
            className="inline-flex items-center gap-2.5 h-12 sm:h-14 px-6 sm:px-7 rounded-lg bg-zinc-900/70 border border-zinc-700 text-white text-base sm:text-xl font-semibold hover:bg-zinc-800 transition-colors backdrop-blur"
          >
            <GitCompareArrows className="w-5 h-5 sm:w-[22px] sm:h-[22px]" strokeWidth={2} />
            Compare
          </Link>
        </div>
      </div>
    </section>
  );
}

function MovieRail({ title, subtitle, movies, href }: { title: string; subtitle: string; movies: TTListedMovie[]; href: string }) {
  // An empty rail adds nothing to discovery -- skip it (the nav still
  // links every listing page).
  if (movies.length === 0) return null;
  return (
    <section>
      <SectionHeading title={title} count={movies.length} subtitle={subtitle} action={<ViewAll href={href} />} />
      <Rail label={title}>
        {movies.map((m) => (
          <MovieCard key={m.slug} movie={m} />
        ))}
      </Rail>
    </section>
  );
}

export default async function HomePage() {
  const { news, reviews, nowShowing, upcoming, upcomingRow, completed } = await getData();
  // Already ordered by the latest day's gross (lib/bfilmy/source.ts).
  const boxOfficeRow = [...completed].sort((a, b) => (b.grossCr ?? 0) - (a.grossCr ?? 0)).slice(0, 18);
  const featured = nowShowing[0] ?? upcomingRow[0] ?? boxOfficeRow[0] ?? null;

  // The exact same live+advance+upcoming+completed movie set
  // lib/compare/useMovieCatalog.ts's client-side hook would otherwise
  // fetch, reused to seed the home page's comparison selectors without a
  // second network round trip.
  const seenSlugs = new Set<string>();
  const compareCatalog = [...nowShowing, ...upcoming, ...completed].filter((m) => {
    if (seenSlugs.has(m.slug)) return false;
    seenSlugs.add(m.slug);
    return true;
  });

  return (
    <div>
      {featured && <Hero movie={featured} />}

      <div className="fx-container pt-10 sm:pt-14 space-y-12 sm:space-y-16">
        <MovieRail title="Now Showing" subtitle="Live box office tracked today" movies={nowShowing} href="/now-showing" />
        <MovieRail title="Upcoming" subtitle="Advance bookings and new releases" movies={upcomingRow} href="/upcoming" />

        {/* Movie Comparison -- same component, state and API as before. */}
        <HomeCompareSection movies={compareCatalog} />

        <MovieRail title="Box Office" subtitle="Highest tracked grosses" movies={boxOfficeRow} href="/box-office" />

        {news.length > 0 && (
          <section>
            <SectionHeading title="Latest from the Industry" count={news.length} subtitle="Box office news and updates" action={<ViewAll href="/news" />} />
            <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-6">
              {news.map((n: any) => (
                <Link key={n.id} href={`/news/${n.id}`} className="group block">
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-surface2 border border-border transition duration-300 group-hover:border-borderStrong">
                    {n.image_url && <Image src={n.image_url} alt="" fill className="object-cover object-top transition duration-500 group-hover:scale-[1.03]" />}
                  </div>
                  <h3 className="mt-3 text-sm sm:text-base font-semibold tracking-tight text-text line-clamp-2 group-hover:text-white">{n.title}</h3>
                  {n.excerpt && <p className="hidden sm:block font-mono text-xs text-textFaint mt-1.5 line-clamp-1">{n.excerpt}</p>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {reviews.length > 0 && (
          <section>
            <SectionHeading title="Fresh Reviews" count={reviews.length} subtitle="Latest critic verdicts" action={<ViewAll href="/reviews" />} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {reviews.map((r: any) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
