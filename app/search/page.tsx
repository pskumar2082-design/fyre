import Link from 'next/link';
import { Search as SearchIcon } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { getLiveMovies, getCompletedMovies } from '@/lib/bfilmy/source';
import { Card, SectionHeading } from '@/components/ui';

export const revalidate = 0; // always fetch fresh results

type Row = Record<string, any>;

async function search(q: string) {
  const empty = { news: [] as Row[], reviews: [] as Row[], movies: [] as Awaited<ReturnType<typeof getLiveMovies>> };
  const term = q.trim();
  if (!term) return empty;

  const like = `%${term}%`;
  const [{ data: news }, { data: reviews }, live, completed] = await Promise.all([
    supabase.from('news').select('*').ilike('title', like).limit(20),
    supabase.from('reviews').select('*').ilike('title', like).limit(20),
    getLiveMovies().catch(() => [] as Awaited<ReturnType<typeof getLiveMovies>>),
    getCompletedMovies().catch(() => [] as Awaited<ReturnType<typeof getCompletedMovies>>)
  ]);

  const needle = term.toLowerCase();
  const movies = [...live, ...completed].filter((m) => m.title.toLowerCase().includes(needle)).slice(0, 20);

  return {
    news: news ?? [],
    reviews: reviews ?? [],
    movies
  };
}

const STATE_LABEL: Record<string, string> = {
  live: 'Live',
  advance: 'Advance booking',
  upcoming: 'Upcoming',
  final: 'Completed run',
  unknown: ''
};

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? '';
  const results = await search(q);
  const total = results.news.length + results.reviews.length + results.movies.length;

  return (
    <div className="fx-container py-8 sm:py-12 max-w-2xl">
      <SectionHeading title="Search" />

      <form action="/search" className="mb-8">
        <div className="flex items-center gap-3 max-w-3xl h-12 sm:h-14 pl-4 pr-2 rounded-xl bg-surface border border-border focus-within:border-zinc-500 transition-colors">
          <SearchIcon size={18} className="text-textFaint flex-none" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search movies, news, reviews…"
            autoFocus
            className="flex-1 min-w-0 bg-transparent outline-none focus-visible:outline-none text-base text-text placeholder:text-textFaint"
          />
          <button type="submit" className="h-9 sm:h-10 px-4 rounded-lg bg-white text-black hover:bg-zinc-200 font-semibold text-sm flex-none transition-colors">
            Search
          </button>
        </div>
      </form>

      {!q.trim() && <p className="text-textFaint text-sm">Type something above to search across fyre.</p>}
      {q.trim() && total === 0 && <p className="text-textFaint text-sm">No results for &ldquo;{q}&rdquo;.</p>}

      {results.news.length > 0 && (
        <ResultSection title="News">
          {results.news.map((n) => (
            <ResultRow key={n.id} href={`/news/${n.id}`} title={n.title} meta={n.date} />
          ))}
        </ResultSection>
      )}

      {results.reviews.length > 0 && (
        <ResultSection title="Reviews">
          {results.reviews.map((r) => (
            <ResultRow key={r.id} href={`/reviews/${r.id}`} title={r.title} meta={`${r.rating} / 5`} />
          ))}
        </ResultSection>
      )}

      {results.movies.length > 0 && (
        <ResultSection title="Movies">
          {results.movies.map((m) => (
            <ResultRow
              key={m.slug}
              href={`/movie/${m.slug}`}
              title={m.title}
              meta={[STATE_LABEL[m.state], m.gross].filter(Boolean).join(' · ')}
            />
          ))}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="hdisplay text-lg mb-3">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function ResultRow({ href, title, meta }: { href: string; title: string; meta?: string }) {
  return (
    <Link href={href} className="block">
      <Card className="px-4 py-3 hover:-translate-y-0.5 transition">
        <div className="text-sm font-medium">{title}</div>
        {meta && <div className="text-xs text-textFaint mt-1">{meta}</div>}
      </Card>
    </Link>
  );
}
