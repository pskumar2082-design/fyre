import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { Section } from '@/lib/newsroom/types';
import { categories, publicArticle, publicArticlePage, publicArticles } from '@/lib/newsroom/public';
import { articlePath, SECTION_LABEL } from '@/lib/newsroom/categories';
import { getNewsroomStore } from '@/lib/newsroom/store';
import { SITE_NAME, SITE_URL } from '@/lib/siteConfig';
import { EmptyState, SectionHeading } from '@/components/ui';
import ArticleCard from './ArticleCard';
import ArticleView from './ArticleView';
import ViewBeacon from './ViewBeacon';

const PER_PAGE = 20;

const SECTION_COPY: Record<Section, { title: string; subtitle: string; description: string }> = {
  news: { title: 'Latest News', subtitle: 'India, the Telugu states, the world, entertainment and technology', description: 'Latest news from India, Andhra Pradesh, Telangana and the world, written by Fyre.' },
  politics: { title: 'Politics', subtitle: 'National and Telugu-state politics, elections and policy', description: 'Indian, Andhra Pradesh and Telangana politics, elections, government announcements and policy, reported by Fyre.' }
};

export async function sectionMetadata(section: Section, categorySlug?: string): Promise<Metadata> {
  const cats = await categories(section);
  const cat = categorySlug ? cats.find((c) => c.slug === categorySlug) : null;
  const title = cat ? `${cat.name} | ${SECTION_LABEL[section]}` : SECTION_COPY[section].title;
  return {
    title,
    description: cat?.description || SECTION_COPY[section].description,
    alternates: { canonical: `${SITE_URL}/${section}${cat ? `/${cat.slug}` : ''}` }
  };
}

export async function SectionIndex({ section, categorySlug, page = 1 }: { section: Section; categorySlug?: string; page?: number }) {
  const cats = await categories(section);
  const cat = categorySlug ? cats.find((c) => c.slug === categorySlug) : null;
  if (categorySlug && !cat) notFound();
  const { items, total } = await publicArticlePage({ section, category: cat?.slug, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const catName = (slug: string) => cats.find((c) => c.slug === slug)?.name;
  const [lead, ...rest] = items;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="fx-container py-8 sm:py-12">
      <SectionHeading title={cat ? cat.name : SECTION_COPY[section].title} subtitle={cat ? cat.description : SECTION_COPY[section].subtitle} />
      <nav aria-label={`${SECTION_LABEL[section]} categories`} className="flex gap-2 overflow-x-auto pb-1 mb-6 -mx-1 px-1">
        <Link href={`/${section}`} aria-current={!cat ? 'page' : undefined} className={`inline-flex items-center h-9 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap border ${!cat ? 'bg-white text-black border-white' : 'bg-surface border-border text-textDim hover:text-white'}`}>
          All
        </Link>
        {cats.map((c) => (
          <Link
            key={c.slug}
            href={`/${section}/${c.slug}`}
            aria-current={cat?.slug === c.slug ? 'page' : undefined}
            className={`inline-flex items-center h-9 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap border ${cat?.slug === c.slug ? 'bg-white text-black border-white' : 'bg-surface border-border text-textDim hover:text-white'}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState>No stories here yet.</EmptyState>
      ) : (
        <>
          {page === 1 && lead ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
              <div className="lg:col-span-2">
                <ArticleCard article={lead} variant="lead" categoryName={catName(lead.category)} />
              </div>
              <div className="rounded-xl border border-border bg-surface px-4 divide-y divide-surface2">
                {rest.slice(0, 4).map((a) => (
                  <ArticleCard key={a.id} article={a} variant="row" categoryName={catName(a.category)} />
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(page === 1 ? rest.slice(4) : items).map((a) => (
              <ArticleCard key={a.id} article={a} categoryName={catName(a.category)} />
            ))}
          </div>
          {pages > 1 && (
            <nav className="flex justify-center gap-3 mt-8 text-sm" aria-label="Pages">
              {page > 1 && <Link href={`?page=${page - 1}`} className="px-4 py-2 rounded-lg border border-border hover:border-borderStrong">Newer</Link>}
              <span className="px-2 py-2 text-textFaint">
                Page {page} of {pages}
              </span>
              {page < pages && <Link href={`?page=${page + 1}`} className="px-4 py-2 rounded-lg border border-border hover:border-borderStrong">Older</Link>}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

async function findArticle(section: Section, categorySlug: string, slug: string) {
  const a = await publicArticle(section, slug);
  if (a) return a;
  // A renamed slug keeps working: send readers to the current URL.
  const store = await getNewsroomStore();
  const moved = store.redirectFor ? await store.redirectFor(section, slug) : null;
  if (moved) permanentRedirect(articlePath(moved));
  return null;
}

export async function articleMetadata(section: Section, categorySlug: string, slug: string): Promise<Metadata> {
  const a = await publicArticle(section, slug).catch(() => null);
  if (!a || a.category !== categorySlug) return {};
  const url = `${SITE_URL}${articlePath(a)}`;
  const title = a.seoTitle || a.headline;
  const description = a.seoDescription || a.description;
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: a.isSample ? { index: false, follow: false } : undefined,
    openGraph: { type: 'article', url, title, description, publishedTime: a.publishAt ?? undefined, modifiedTime: a.updatedAt, images: a.heroImageUrl ? [{ url: a.heroImageUrl, alt: a.heroImageAlt }] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: a.heroImageUrl ? [a.heroImageUrl] : undefined }
  };
}

export async function ArticlePage({ section, categorySlug, slug }: { section: Section; categorySlug: string; slug: string }) {
  const a = await findArticle(section, categorySlug, slug);
  if (!a) notFound();
  if (a.category !== categorySlug) permanentRedirect(articlePath(a));
  const cats = await categories(section);
  const categoryName = cats.find((c) => c.slug === a.category)?.name ?? a.category;
  const related = (await publicArticles({ section, category: a.category, limit: 4 })).filter((x) => x.id !== a.id).slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: a.headline,
    description: a.description,
    datePublished: a.publishAt,
    dateModified: a.updatedAt,
    image: a.heroImageUrl ? [a.heroImageUrl] : undefined,
    author: a.author ? [{ '@type': 'Person', name: a.author }] : [{ '@type': 'Organization', name: SITE_NAME }],
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
    mainEntityOfPage: `${SITE_URL}${articlePath(a)}`,
    articleSection: categoryName
  };

  return (
    <div className="fx-container py-8 sm:py-12">
      {!a.isSample && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <ViewBeacon id={a.id} />
      <ArticleView article={a} categoryName={categoryName} />
      {related.length > 0 && (
        <section className="max-w-3xl mt-12">
          <h2 className="font-bold text-xl text-text mb-4">More in {categoryName}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {related.map((r) => (
              <ArticleCard key={r.id} article={r} categoryName={categoryName} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function pageParam(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 && n < 10_000 ? n : 1;
}
