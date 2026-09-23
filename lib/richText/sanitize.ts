import DOMPurify from 'isomorphic-dompurify';
import { TEXT_COLOR_VALUES, HIGHLIGHT_COLOR_VALUES, FONT_SIZE_VALUES } from './tokens';

// ---------------------------------------------------------------------
// The ONE place article rich-text HTML is sanitized. Called from two
// places, both on purpose (defense in depth, not redundancy):
//   1. app/admin/page.tsx's handleSubmit(), right before a news/review
//      `content` payload is written to Supabase -- so what's actually
//      stored is already clean, not just what's rendered.
//   2. components/ArticleBody.tsx, right before the stored HTML is
//      handed to dangerouslySetInnerHTML on the public site -- the
//      authoritative barrier, since it runs on every render regardless
//      of how the HTML got into the `content` column (the admin form
//      today, but also a future admin tool, a direct Supabase edit, or
//      old data from before this system existed).
// Every tag/attribute allowed below is exactly what FyreRichTextEditor
// can produce and what ArticleBody's .fyre-article CSS (app/globals.css)
// has styling for -- nothing is allowed through "just in case".
// ---------------------------------------------------------------------

const ALLOWED_TAGS = [
  'p',
  'h2',
  'h3',
  'h4',
  'strong',
  'em',
  'u',
  's',
  'blockquote',
  'ul',
  'ol',
  'li',
  'a',
  'span',
  'mark',
  'hr',
  'br',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td'
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'style', 'colspan', 'rowspan', 'data-color'];

// Only these three style declarations ever leave the editor (see
// lib/richText/tokens.ts), each restricted to one of a fixed set of
// values -- never an admin-typed color or px value. Anything else found
// in a `style` attribute (a pasted Word/Google Docs background-color, a
// font-family, an absolute position, literally anything) is stripped,
// not passed through.
const ALLOWED_STYLE_PROPS: Record<string, readonly string[]> = {
  color: TEXT_COLOR_VALUES,
  'background-color': HIGHLIGHT_COLOR_VALUES,
  'font-size': FONT_SIZE_VALUES,
  'text-align': ['left', 'center', 'right', 'justify']
};

function sanitizeStyleAttr(value: string): string {
  const kept: string[] = [];
  for (const declaration of value.split(';')) {
    const idx = declaration.indexOf(':');
    if (idx === -1) continue;
    const prop = declaration.slice(0, idx).trim().toLowerCase();
    const val = declaration.slice(idx + 1).trim();
    const allowedValues = ALLOWED_STYLE_PROPS[prop];
    if (allowedValues && (allowedValues as readonly string[]).includes(val)) {
      kept.push(`${prop}: ${val}`);
    }
  }
  return kept.join('; ');
}

let hooksInstalled = false;
function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  // style="..." -- rebuild from only the allowed prop:value pairs above;
  // drop the attribute entirely if nothing survives.
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style') {
      const cleaned = sanitizeStyleAttr(data.attrValue);
      if (!cleaned) {
        data.keepAttr = false;
      } else {
        data.attrValue = cleaned;
      }
    }
  });

  // Every external link gets a forced-safe rel, regardless of what (if
  // anything) survived sanitization on it, and target is normalized to
  // _blank -- an admin can paste a link with any target/rel and this is
  // what actually ships.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer nofollow');
    }
  });
}

// Only http(s)/mailto links survive -- no javascript:, data:, vbscript:,
// or any other scheme DOMPurify's own default allowlist might permit.
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:)/i;

export function sanitizeArticleHtml(html: string): string {
  installHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'svg', 'math'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcdoc']
  }).trim();
}
