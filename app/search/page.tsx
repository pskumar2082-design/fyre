import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export const revalidate = 0; // always fetch fresh results

type Row = Record<string, any>;

async function search(q: string) {
  const empty = { news: [] as Row[], reviews: [] as Row[], liveBoxOffice: [] as Row[], nowShowing: [] as Row[], upcoming: [] as Row[] };
  const term = q.trim();
  if (!term) return empty;

  const like = `%${term}%`;
  const [
    { data: news },
    { data: reviews },
    { data: liveBoxOffice },
    { data: nowShowing },
    { data: upcoming }
  ] = await Promise.all([
    supabase.from('news').select('*').ilike('title', like).limit(20),
    supabase.from('reviews').select('*').ilike('title', like).limit(20),
    supabase.from('live_box_office').select('*').ilike('title', like).limit(20),
    supabase.from('now_showing').select('*').ilike('title', like).limit(20),
    supabase.from('upcoming').select('*').ilike('title', like).limit(20)
  ]);

  return {
    news: news ?? [],
    reviews: reviews ?? [],
    liveBoxOffice: liveBoxOffice ?? [],
    nowShowing: nowShowing ?? [],
    upcoming: upcoming ?? []
  };
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? '';
  const results = await search(q);
  const total =
    results.news.length +
    results.reviews.length +
    results.liveBoxOffice.length +
    results.nowShowing.length +
    results.upcoming.length;

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <h1 className="hdisplay gtext text-2xl mb-5">Search</h1>

      <form action="/search" className="flex gap-2 mb-8">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search movies, news, reviews…"
          autoFocus
          className="flex-1 bg-surface border border-border rounded-full px-5 py-2.5 text-sm focus:outline-none focus:border-goldDim"
        />
        <button type="submit" className="bg-gold text-white font-semibold rounded-full px-5 py-2.5 text-sm">
          Search
        </button>
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

      {results.liveBoxOffice.length > 0 && (
        <ResultSection title="Box office">
          {results.liveBoxOffice.map((m) => (
            <ResultRow key={m.id} href="/#boxoffice" title={m.title} meta={`₹${Number(m.amt).toFixed(1)} Cr`} />
          ))}
        </ResultSection>
      )}

      {results.nowShowing.length > 0 && (
        <ResultSection title="Now showing">
          {results.nowShowing.map((m) => (
            <ResultRow key={m.id} href={`/now-showing/${m.id}`} title={m.title} meta={m.status} />
          ))}
        </ResultSection>
      )}

      {results.upcoming.length > 0 && (
        <ResultSection title="Upcoming">
          {results.upcoming.map((u) => (
            <ResultRow key={u.id} href="/#upcoming" title={u.title} meta={u.release_date} />
          ))}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="hdisplay text-xl mb-3">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function ResultRow({ href, title, meta }: { href: string; title: string; meta?: string }) {
  return (
    <Link href={href} className="block bg-surface border border-border rounded-2xl px-4 py-3 hover:border-goldDim transition">
      <div className="text-sm font-medium">{title}</div>
      {meta && <div className="text-xs text-textFaint mt-1">{meta}</div>}
    </Link>
  );
}
