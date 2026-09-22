import { parseMarkdownTable } from '@/lib/articleTable';
import ArticleTable from './ArticleTable';

// Shared body renderer for a news article and a review -- both store their
// full text the same way (content, blank-line-separated paragraphs; see
// app/news/[id]/page.tsx and app/reviews/[id]/page.tsx) and both now support
// a table embedded anywhere in the middle of that text, so this one
// component decides, block by block, whether to render a <p> or a styled
// <ArticleTable>, instead of each page duplicating that check.
export default function ArticleBody({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim() !== '');

  return (
    <>
      {blocks.map((block, i) => {
        const table = parseMarkdownTable(block);
        if (table) return <ArticleTable key={i} table={table} />;
        return (
          <p key={i} className="mb-5">
            {block}
          </p>
        );
      })}
    </>
  );
}
