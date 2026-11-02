import Link from 'next/link';
import { homeSections, publicArticles, trendingArticles } from '@/lib/newsroom/public';
import { categories } from '@/lib/newsroom/public';
import { loadSports } from '@/lib/sports/load';
import { loadMoviesHome } from '@/lib/movies/public';
import { sportsEnabled } from '@/lib/v2/flags';
import type { Article } from '@/lib/newsroom/types';
import ArticleCard from '@/components/newsroom/ArticleCard';
import MatchCard from '@/components/sports/MatchCard';
import { BoxOfficeTable, PosterCard } from '@/components/movies/MoviesBits';
import { articlePath } from '@/lib/newsroom/categories';

function Heading({ title, href, linkLabel = 'View all', note }: { title: string; href?: string; linkLabel?: string; note?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="hdisplay font-extrabold text-[22px] sm:text-[28px] leading-tight text-text">{title}</h2>
        {note && <p className="font-mono text-[11px] sm:text-xs text-amber mt-1">{note}</p>}
      </div>
      {href && (
        <Link href={href} className="flex-none text-sm sm:text-base font-semibold text-zinc-300 hover:text-white">
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

// The new homepage: Movies | Sports | Latest News | Politics. Section order
// and visibility come from Admin -> Newsroom -> Homepage.
export default async function HomeV2() {
  const now = new Date();
  const [sections, featured, latest, politics, trending, sports, movies, newsCats, polCats] = await Promise.all([
    homeSections(),
    publicArticles({ featuredOnly: true, limit: 5 }),
    publicArticles({ limit: 8 }),
    publicArticles({ section: 'politics', limit: 4 }),
    trendingArticles(5),
    sportsEnabled() ? loadSports() : Promise.resolve(null),
    loadMoviesHome(),
    categories('news'),
    categories('politics')
  ]);
  const catName = (a: Article) => (a.section === 'news' ? newsCats : polCats).find((c) => c.slug === a.category)?.name;

  // Headlines: featured stories in their order, topped up with the newest.
  const headlines: Article[] = [...featured];
  for (const a of latest) if (headlines.length < 5 && !headlines.some((h) => h.id === a.id)) headlines.push(a);
  const [lead, ...side] = headlines;

  const blocks: Record<string, React.ReactNode> = {
    headlines: (
      <section>
        <Heading title="Latest Headlines" href="/news" linkLabel="All news" />
        {!lead ? (
          <p className="text-sm text-textFaint">Fyre&apos;s stories will appear here once published.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <ArticleCard article={lead} variant="lead" categoryName={catName(lead)} />
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 divide-y divide-surface2">
              {side.map((a) => (
                <ArticleCard key={a.id} article={a} variant="row" categoryName={catName(a)} />
              ))}
            </div>
          </div>
        )}
      </section>
    ),
    cricket:
      sports && sports.ok ? (
        <section>
          <Heading title="Live Cricket Scores" href="/live-scores" linkLabel="All scores" note={sports.feed.isTestData ? 'Test data: not real scores' : undefined} />
          {(() => {
            const cards = [...sports.groups.live, ...sports.groups.upcoming].slice(0, 3);
            return cards.length === 0 ? (
              <p className="text-sm text-textFaint">No live or upcoming matches right now.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {cards.map((m) => (
                  <MatchCard key={m.id} match={m} feed={sports.feed} now={sports.now} compact />
                ))}
              </div>
            );
          })()}
        </section>
      ) : null,
    now_showing: movies.ok ? (
      <section>
        <Heading title="Now Showing Telugu Movies" href="/movies" linkLabel="All movies" note={movies.isTestData ? 'Test data: sample movies' : undefined} />
        {movies.nowShowing.length === 0 ? (
          <p className="text-sm text-textFaint">No movies in theatres right now.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {movies.nowShowing.map((m) => (
              <PosterCard key={m.id} movie={m} now={now} />
            ))}
          </div>
        )}
      </section>
    ) : null,
    box_office: movies.ok ? (
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <Heading title="Box Office Collections" href="/movies" linkLabel="Full table" note={movies.isTestData ? 'Test data: not real collections' : undefined} />
        <BoxOfficeTable rows={movies.boxOffice.slice(0, 6)} compact />
      </section>
    ) : null,
    politics: (
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <Heading title="Political Updates" href="/politics" linkLabel="All politics" />
        {politics.length === 0 ? (
          <p className="text-sm text-textFaint">Political stories will appear here once published.</p>
        ) : (
          <div className="divide-y divide-surface2">
            {politics.map((a) => (
              <ArticleCard key={a.id} article={a} variant="row" categoryName={catName(a)} />
            ))}
          </div>
        )}
      </section>
    ),
    trending:
      trending.length > 0 ? (
        <section>
          <Heading title="Trending Stories" />
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-8 rounded-xl border border-border bg-surface px-4 sm:px-5">
            {trending.map((a, i) => (
              <li key={a.id} className="flex gap-4 py-3 border-b border-surface2 last:border-b-0 md:[&:nth-last-child(2)]:border-b-0">
                <span className="font-mono font-bold text-2xl text-gold w-6 flex-none">{i + 1}</span>
                <Link href={articlePath(a)} className="min-w-0 group">
                  <span className="block font-semibold text-text leading-snug group-hover:text-gold">{a.headline}</span>
                  <span className="block font-mono text-[11px] text-textFaint mt-1">{catName(a)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null
  };

  // Box office and politics sit side by side on wide screens when adjacent.
  const order = sections.filter((s) => s.enabled).map((s) => s.key);
  const rendered: React.ReactNode[] = [];
  for (let i = 0; i < order.length; i++) {
    const k = order[i];
    const next = order[i + 1];
    if ((k === 'box_office' && next === 'politics') || (k === 'politics' && next === 'box_office')) {
      rendered.push(
        <div key={`${k}-${next}`} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {blocks[k]}
          {blocks[next]}
        </div>
      );
      i++;
    } else if (blocks[k]) rendered.push(<div key={k}>{blocks[k]}</div>);
  }

  return <div className="fx-container py-8 sm:py-10 space-y-10 sm:space-y-12">{rendered}</div>;
}
