import { parseMarkdownTable } from '@/lib/articleTable';

// One-way, load-time-only conversion of the OLD plain-text article format
// (blank-line-separated paragraphs, optionally with a markdown pipe-table
// block -- see lib/articleTable.ts) into the HTML FyreRichTextEditor
// expects. Used exactly once: app/admin/page.tsx's startEdit() calls this
// when an admin opens an old article for editing, so it loads into the
// editor as real paragraphs/tables instead of the browser's HTML parser
// collapsing the whole blank-line-separated text into one paragraph (an
// HTML parser has no concept of "blank line means new paragraph" --
// that's this codebase's own plain-text convention, not markup).
//
// Nothing is migrated in bulk and nothing is written back until the admin
// actually saves -- an article this is never called on (never re-opened
// for editing) keeps rendering through ArticleBody's original plain-text
// path forever, unchanged.
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function legacyContentToHtml(content: string): string {
  const blocks = content.split(/\n\s*\n/).filter((b) => b.trim() !== '');
  return blocks
    .map((block) => {
      const table = parseMarkdownTable(block);
      if (table) {
        const thead = `<tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
        const tbody = table.rows
          .map((row) => `<tr>${table.headers.map((_, i) => `<td>${escapeHtml(row[i] ?? '')}</td>`).join('')}</tr>`)
          .join('');
        return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
      }
      // A blank line inside a "paragraph" block (shouldn't happen given the
      // block split above, but a single literal newline mid-block --
      // someone hit Enter once, not twice -- still needs to become
      // something HTML preserves; a <br> mirrors what a browser does with
      // Shift+Enter).
      return `<p>${escapeHtml(block).split('\n').join('<br>')}</p>`;
    })
    .join('');
}
