import Image from 'next/image';
import Link from 'next/link';
import type { Article } from '@/lib/newsroom/types';
import { KIND_LABEL, SECTION_LABEL } from '@/lib/newsroom/categories';
import { istDateTime, readMinutes } from '@/lib/newsroom/format';
import ArticleBody from '@/components/ArticleBody';

// The full article, used by the public page and by the admin preview so an
// editor sees exactly what readers will see.
export default function ArticleView({ article, categoryName, preview = false }: { article: Article; categoryName: string; preview?: boolean }) {
  const updated = article.publishAt && Date.parse(article.updatedAt) - Date.parse(article.publishAt) > 10 * 60_000;
  return (
    <article className="max-w-3xl">
      {(preview || article.isSample) && (
        <div className="mb-5 rounded-lg border border-amber/60 bg-amber/10 px-4 py-2.5 text-sm text-text">
          {preview ? 'Preview: only admins can see this page until it is published.' : 'Sample article for local testing. It is not news.'}
        </div>
      )}
      <nav className="font-mono text-xs text-textDim mb-3 flex flex-wrap gap-x-2">
        <Link href={`/${article.section}`} className="hover:text-white">
          {SECTION_LABEL[article.section]}
        </Link>
        <span>/</span>
        <Link href={`/${article.section}/${article.category}`} className="hover:text-white">
          {categoryName}
        </Link>
      </nav>
      <span className={`inline-block font-mono text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded mb-3 ${article.kind === 'opinion' ? 'bg-violet/20 text-violet' : article.kind === 'analysis' ? 'bg-sky/20 text-sky' : 'bg-surface2 text-textDim'}`}>
        {KIND_LABEL[article.kind]}
      </span>
      <h1 className="hdisplay font-extrabold text-[28px] sm:text-[40px] leading-tight text-text">{article.headline}</h1>
      {article.description && <p className="text-lg text-textDim mt-3">{article.description}</p>}
      <div className="mt-4 pb-4 border-b border-border text-sm text-textFaint flex flex-wrap gap-x-3 gap-y-1">
        {article.author && <span className="text-textDim">{article.author}</span>}
        <span>Published {istDateTime(article.publishAt) || '(not yet)'}</span>
        {updated && <span>Updated {istDateTime(article.updatedAt)}</span>}
        <span>{readMinutes(article.bodyHtml)} min read</span>
      </div>
      {article.heroImageUrl && (
        <figure className="mt-6">
          <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-surface2">
            <Image src={article.heroImageUrl} alt={article.heroImageAlt} fill unoptimized sizes="800px" className="object-cover" />
          </div>
          {article.imageCredit && <figcaption className="mt-2 text-xs text-textFaint">Image: {article.imageCredit}</figcaption>}
        </figure>
      )}
      <div className="mt-6 text-[17px] leading-[1.8] text-text">
        <ArticleBody content={article.bodyHtml} />
      </div>
      {article.sources.length > 0 && (
        <section className="mt-8 rounded-xl border border-border bg-surface p-5">
          <h2 className="font-bold text-text mb-3">Sources</h2>
          <ul className="space-y-2 text-sm">
            {article.sources.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-gold hover:underline">
                  {s.name}
                </a>
                <span className="text-textFaint"> · checked {s.checkedOn}</span>
              </li>
            ))}
          </ul>
          {article.factCheckedBy && <p className="mt-3 text-xs text-textFaint">Facts checked by {article.factCheckedBy}.</p>}
        </section>
      )}
      {article.correctionNote && (
        <section className="mt-6 rounded-xl border border-amber/50 bg-amber/5 p-5 text-sm">
          <h2 className="font-bold text-text mb-1">Correction</h2>
          <p className="text-textDim">{article.correctionNote}</p>
        </section>
      )}
      {article.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {article.tags.map((t) => (
            <span key={t} className="font-mono text-xs text-textDim bg-surface2 border border-border rounded-md px-2 py-1">
              #{t}
            </span>
          ))}
        </div>
      )}
      <p className="mt-8 text-xs text-textFaint">
        Fyre writes its own reporting and credits other outlets in Sources. Read our <Link href="/editorial-policy" className="underline hover:text-white">editorial policy</Link>.
      </p>
    </article>
  );
}
