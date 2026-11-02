'use client';

import { useEffect, useState } from 'react';
import type { Article, Category } from '@/lib/newsroom/types';
import ArticleView from '@/components/newsroom/ArticleView';
import { adminFetch } from '@/components/admin/newsroom/adminFetch';

// Admin-only preview of a draft or scheduled article, rendered with the
// same component readers see. The article is fetched through the admin API
// with the signed-in session, so a preview link shared with someone who is
// not signed in shows nothing.
export default function PreviewPage({ params }: { params: { id: string } }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([adminFetch(`/api/admin/newsroom/articles/${params.id}`), adminFetch('/api/admin/newsroom/settings')])
      .then(([a, s]) => {
        setArticle(a.article);
        setCats(s.categories);
      })
      .catch((e) => setError(e.message === 'unauthorized' ? 'Sign in at /admin to preview articles.' : e.message));
  }, [params.id]);
  if (error) return <div className="fx-container py-12 text-textDim">{error}</div>;
  if (!article) return <div className="fx-container py-12 text-textFaint">Loading preview…</div>;
  const categoryName = cats.find((c) => c.section === article.section && c.slug === article.category)?.name ?? article.category;
  return (
    <div className="fx-container py-8 sm:py-12">
      <ArticleView article={article} categoryName={categoryName} preview />
    </div>
  );
}
