import Link from 'next/link';
import Image from 'next/image';
import type { Article } from '@/lib/newsroom/types';
import { articlePath, KIND_LABEL } from '@/lib/newsroom/categories';
import { timeAgo } from '@/lib/newsroom/format';

export function ArticleMeta({ article, categoryName, now }: { article: Article; categoryName?: string; now?: Date }) {
  return (
    <span className="font-mono text-[11px] sm:text-xs text-textFaint">
      {[categoryName, KIND_LABEL[article.kind], timeAgo(article.publishAt, now ?? new Date())].filter(Boolean).join(' · ')}
    </span>
  );
}

// variant: lead (big, image), card (grid), row (compact list item)
export default function ArticleCard({ article, variant = 'card', categoryName }: { article: Article; variant?: 'lead' | 'card' | 'row'; categoryName?: string }) {
  const href = articlePath(article);
  if (variant === 'row') {
    return (
      <Link href={href} className="group block py-3">
        <span className="block font-semibold text-text text-[15px] leading-snug group-hover:text-gold transition-colors">{article.headline}</span>
        <span className="block mt-1">
          <ArticleMeta article={article} categoryName={categoryName} />
        </span>
      </Link>
    );
  }
  const lead = variant === 'lead';
  return (
    <Link href={href} className="group block h-full rounded-xl border border-border bg-surface overflow-hidden hover:border-borderStrong transition-colors">
      <div className={`relative w-full bg-surface2 ${lead ? 'aspect-[16/8]' : 'aspect-[16/9]'}`}>
        {article.heroImageUrl ? (
          <Image src={article.heroImageUrl} alt={article.heroImageAlt} fill unoptimized sizes={lead ? '800px' : '400px'} className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface2 to-black">
            <span className="font-mono text-xs uppercase tracking-widest text-textFaint">{article.section === 'politics' ? 'Politics' : 'Fyre News'}</span>
          </div>
        )}
      </div>
      <div className={lead ? 'p-5 sm:p-6' : 'p-4'}>
        <h3 className={`font-bold text-text leading-snug group-hover:text-gold transition-colors ${lead ? 'text-xl sm:text-2xl' : 'text-base'}`}>{article.headline}</h3>
        {article.description && <p className={`text-textDim mt-2 ${lead ? 'text-[15px] line-clamp-3' : 'text-sm line-clamp-2'}`}>{article.description}</p>}
        <div className="mt-3">
          <ArticleMeta article={article} categoryName={categoryName} />
        </div>
      </div>
    </Link>
  );
}
