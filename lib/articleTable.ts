// A news article or review is plain text (see app/news/[id]/page.tsx and
// app/reviews/[id]/page.tsx), split into paragraphs on blank lines. This
// lets one of those blank-line-separated blocks instead be a small GFM-style
// pipe table -- the same format the admin panel's table builder generates
// (see components/admin/TableBuilder.tsx) and the same shape a person typing
// directly into the content textarea would naturally reach for (a header
// row, a "|---|---|" separator row, then data rows, all consecutive lines --
// still its own block since it's set off from the surrounding prose by a
// blank line on each side).

export type ParsedTable = { headers: string[]; rows: string[][] };

// A separator row like "|---|---|---|" or "---|:--:|---" -- only dashes,
// colons (alignment markers, accepted but not acted on -- this site's
// tables are always left-label / right-number, never centered), pipes and
// whitespace, with at least one run of 2+ dashes so a stray line of just
// "---" (a plain divider, not a table) doesn't get misread as one.
const SEPARATOR_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((cell) => cell.trim());
}

// Returns null for anything that isn't unambiguously a table -- a normal
// paragraph that happens to contain a "|" character (rare, but this is
// user-typed content) still needs its second line to be a real separator
// row before this treats it as tabular data.
export function parseMarkdownTable(block: string): ParsedTable | null {
  const lines = block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
  if (lines.length < 2) return null;
  if (!lines[0].includes('|')) return null;
  if (!SEPARATOR_RE.test(lines[1])) return null;

  const headers = splitRow(lines[0]);
  if (headers.length < 2) return null;

  const rows = lines.slice(2).map(splitRow);
  return { headers, rows };
}

// The inverse -- used by the admin table builder to turn its grid back into
// the same plain-text block format parseMarkdownTable reads. A literal "|"
// typed into a cell would otherwise be read back as an extra column
// boundary, so it's swapped for "/" rather than silently corrupting the
// table on the next edit.
function sanitizeCell(value: string): string {
  return value.replace(/\|/g, '/').replace(/\n/g, ' ').trim();
}

export function tableToMarkdown(headers: string[], rows: string[][]): string {
  const h = headers.map(sanitizeCell);
  const headerLine = `| ${h.join(' | ')} |`;
  const sepLine = `|${h.map(() => '---').join('|')}|`;
  const rowLines = rows.map((row) => `| ${h.map((_, i) => sanitizeCell(row[i] ?? '')).join(' | ')} |`);
  return [headerLine, sepLine, ...rowLines].join('\n');
}

// Used for social-preview descriptions (generateMetadata in the news/review
// detail pages) when there's no separate excerpt to fall back on -- a raw
// pipe-table block truncated to 200 characters would otherwise show up as
// mangled "| Film | Gross |..." text in an X/WhatsApp share card.
export function stripTables(content: string): string {
  return content
    .split(/\n\s*\n/)
    .filter((block) => !parseMarkdownTable(block))
    .join('\n\n');
}
