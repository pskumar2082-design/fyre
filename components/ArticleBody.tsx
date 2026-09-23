import { parseMarkdownTable } from '@/lib/articleTable';
import { sanitizeArticleHtml } from '@/lib/richText/sanitize';
import ArticleTable from './ArticleTable';

// Shared body renderer for a news article and a review. Two storage
// formats coexist in the same `content` text column on purpose --
// FyreRichTextEditor (components/admin/FyreRichTextEditor.tsx) is the
// only way to write NEW articles from this point on, and it always
// produces HTML, but every article written before this editor existed
// is still plain text (blank-line-separated paragraphs, optionally with
// a hand-typed/TableBuilder markdown table block -- see
// lib/articleTable.ts). Rather than migrating that old data, both
// formats render correctly forever: looksLikeHtml() below is the only
// thing that decides which path a given article takes, and it's a
// one-way street (new content is never written back out as plain text).
//
// SANITIZATION: this is the second and authoritative barrier (the first
// is app/admin/page.tsx's handleSubmit(), which already sanitizes before
// writing to Supabase) -- sanitizeArticleHtml() runs again here, on every
// render, regardless of how the stored HTML got into the `content`
// column, before it ever reaches dangerouslySetInnerHTML. See
// lib/richText/sanitize.ts for exactly what's allowed through.
function looksLikeHtml(content: string): boolean {
  return /^\s*<(p|h2|h3|h4|ul|ol|blockquote|table|hr)[\s>]/i.test(content);
}

export default function ArticleBody({ content }: { content: string }) {
  if (looksLikeHtml(content)) {
    const safe = sanitizeArticleHtml(content);
    // eslint-disable-next-line react/no-danger
    return <div className="fyre-article" dangerouslySetInnerHTML={{ __html: safe }} />;
  }

  // Legacy plain-text format -- unchanged from before FyreRichTextEditor
  // existed, so every article written before this system still renders
  // exactly as it always has.
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim() !== '');

  return (
    <div className="fyre-article">
      {blocks.map((block, i) => {
        const table = parseMarkdownTable(block);
        if (table) return <ArticleTable key={i} table={table} />;
        return (
          <p key={i} className="mb-5">
            {block}
          </p>
        );
      })}
    </div>
  );
}
