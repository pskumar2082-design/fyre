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

// TipTap's own getHTML() never emits the exact color strings in
// tokens.ts back out -- the browser/jsdom DOM it builds the HTML from
// normalizes every color through its own CSSOM on the way out:
// `#2F6FED` comes back as `rgb(47, 111, 237)`, and even an
// already-rgba() token like `rgba(255,255,255,0.62)` comes back with
// spaces added after each comma. Confirmed directly (a headless TipTap
// editor in this same sanitize path): every single curated color in
// tokens.ts round-trips through editor.getHTML() into a DIFFERENT
// string than the one in ALLOWED_STYLE_PROPS, so a plain `===`/
// `includes()` check here never matched anything -- not one color or
// highlight from the toolbar has ever actually survived sanitization,
// which is why picking any of them never visibly did anything. Parsing
// both sides down to r/g/b/a numbers before comparing is what actually
// makes "is this one of our curated colors" format-independent.
function parseColor(value: string): [number, number, number, number] | null {
  const v = value.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{6})$/);
  if (m) {
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  m = v.match(/^#([0-9a-f]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16));
    return [r, g, b, 1];
  }
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
  if (m) {
    return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
  }
  return null;
}

function colorValuesMatch(a: string, b: string): boolean {
  const pa = parseColor(a);
  const pb = parseColor(b);
  if (!pa || !pb) return a.trim() === b.trim();
  return pa[0] === pb[0] && pa[1] === pb[1] && pa[2] === pb[2] && Math.abs(pa[3] - pb[3]) < 0.001;
}

const COLOR_PROPS = new Set(['color', 'background-color']);

function sanitizeStyleAttr(value: string): string {
  const kept: string[] = [];
  for (const declaration of value.split(';')) {
    const idx = declaration.indexOf(':');
    if (idx === -1) continue;
    const prop = declaration.slice(0, idx).trim().toLowerCase();
    const val = declaration.slice(idx + 1).trim();
    const allowedValues = ALLOWED_STYLE_PROPS[prop];
    if (!allowedValues) continue;
    // Store the curated token's own canonical spelling, not whatever
    // format the browser handed back -- keeps everything written to
    // Supabase in one consistent representation regardless of which
    // browser (or a future editor version) produced it.
    const match = COLOR_PROPS.has(prop)
      ? (allowedValues as readonly string[]).find((allowed) => colorValuesMatch(allowed, val))
      : (allowedValues as readonly string[]).find((allowed) => allowed === val);
    if (match) {
      kept.push(`${prop}: ${match}`);
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

// A handful of literal `&` `<` `>` `"` `'` characters -- deliberately
// nothing fancier (no full HTML-entity table) since this only ever runs
// on plain text this function has already stripped every tag out of.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeArticleHtml(html: string): string {
  installHooks();
  try {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_URI_REGEXP,
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'svg', 'math'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'srcdoc']
    }).trim();
  } catch (err) {
    // DOMPurify/jsdom throwing on some particular piece of content must
    // never take the whole article page down with it (that's exactly
    // what happened in production before this fallback existed). Fail
    // safe, not loud: strip every tag down to plain escaped text -- never
    // pass the original HTML through unsanitized -- so the article still
    // renders, just without rich formatting, while this gets investigated.
    // eslint-disable-next-line no-console
    console.error('sanitizeArticleHtml: DOMPurify threw, falling back to plain text', err);
    const text = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text ? `<p>${escapeHtml(text)}</p>` : '';
  }
}
