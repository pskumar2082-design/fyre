import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteConfig';
import { getComparison, parseCompareParams, type CompareRequest } from '@/lib/analytics/compare';
import type { Comparison } from '@/lib/analytics/types';
import ComparePageClient from './ComparePageClient';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | undefined>;

function toParams(sp: SP): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v != null) p.set(k, v);
  return p;
}

function initialRequest(sp: SP): { req: CompareRequest; slugs: string[] } {
  const parsed = parseCompareParams(toParams(sp));
  if (!('error' in parsed)) return { req: parsed, slugs: parsed.slugs };
  const slugs = (sp.movies ?? [sp.a, sp.b, sp.c, sp.d].filter(Boolean).join(',')).split(',').filter(Boolean);
  return { req: { slugs, selection: { basis: 'day', day: 1 }, dimension: 'state', metric: 'gross', limit: 10 }, slugs };
}

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const fallback: Metadata = {
    title: 'Movie Comparison — Box Office Head to Head',
    description: 'Compare box office by release day: Day 1 vs Day 1, cumulative, lifetime and advance, with state, city, language, chain and venue splits.',
    alternates: { canonical: `${SITE_URL}/compare` }
  };
  const { req, slugs } = initialRequest(searchParams);
  if (slugs.length < 2) return fallback;
  try {
    const cmp = await getComparison({ ...req, dimension: null, trend: false });
    const titles = cmp.movies.map((m) => m.title);
    if (titles.length < 2) return fallback;
    return {
      title: `${titles.join(' vs ')} — ${cmp.selectionLabel}${cmp.territory === 'US' ? ' USA (Indian-language screenings)' : ''} Box Office Comparison`,
      description: `${titles.join(' vs ')}: ${cmp.selectionLabel.toLowerCase()} gross, tickets, shows and occupancy side by side.`,
      alternates: { canonical: `${SITE_URL}/compare?movies=${slugs.join(',')}` }
    };
  } catch {
    return fallback;
  }
}

export default async function ComparePage({ searchParams }: { searchParams: SP }) {
  const { req, slugs } = initialRequest(searchParams);
  if (!req.dimension && !('dimension' in searchParams)) req.dimension = 'state';
  let initial: Comparison | null = null;
  if (slugs.length >= 2) {
    try {
      initial = await getComparison(req);
    } catch {
      initial = null;
    }
  }
  return (
    <div className="px-5 md:px-10 py-8 max-w-6xl mx-auto">
      <ComparePageClient initialRequest={req} initial={initial} />
    </div>
  );
}
