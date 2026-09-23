import { describe, it, expect } from 'vitest';
import { sanitizeArticleHtml } from '../sanitize';
import { TEXT_COLORS, HIGHLIGHT_COLORS, FONT_SIZES } from '../tokens';

describe('sanitizeArticleHtml -- allowed content passes through', () => {
  it('keeps a plain paragraph', () => {
    expect(sanitizeArticleHtml('<p>Hello world.</p>')).toBe('<p>Hello world.</p>');
  });

  it('keeps bold, italic, underline, strikethrough', () => {
    const html = '<p><strong>bold</strong> <em>italic</em> <u>underline</u> <s>strike</s></p>';
    expect(sanitizeArticleHtml(html)).toBe(html);
  });

  it('keeps H2 and H3 headings', () => {
    expect(sanitizeArticleHtml('<h2>A heading</h2>')).toBe('<h2>A heading</h2>');
    expect(sanitizeArticleHtml('<h3>A subheading</h3>')).toBe('<h3>A subheading</h3>');
  });

  it('keeps a blockquote', () => {
    expect(sanitizeArticleHtml('<blockquote>quoted text</blockquote>')).toBe('<blockquote>quoted text</blockquote>');
  });

  it('keeps bulleted and numbered lists', () => {
    expect(sanitizeArticleHtml('<ul><li>a</li><li>b</li></ul>')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(sanitizeArticleHtml('<ol><li>a</li><li>b</li></ol>')).toBe('<ol><li>a</li><li>b</li></ol>');
  });

  it('keeps multiple paragraphs intact', () => {
    const html = '<p>First.</p><p>Second.</p><p>Third.</p>';
    expect(sanitizeArticleHtml(html)).toBe(html);
  });

  it('keeps a table with header and body rows', () => {
    const html = '<table><thead><tr><th>Film</th><th>Gross</th></tr></thead><tbody><tr><td>A</td><td>1cr</td></tr></tbody></table>';
    expect(sanitizeArticleHtml(html)).toBe(html);
  });

  it('keeps a horizontal rule', () => {
    expect(sanitizeArticleHtml('<p>a</p><hr><p>b</p>')).toBe('<p>a</p><hr><p>b</p>');
  });
});

describe('sanitizeArticleHtml -- curated color/size/highlight/alignment survive', () => {
  it('keeps every curated text color exactly', () => {
    for (const c of TEXT_COLORS) {
      const html = `<p><span style="color: ${c.value}">text</span></p>`;
      expect(sanitizeArticleHtml(html)).toContain(`color: ${c.value}`);
    }
  });

  it('keeps every curated font size exactly', () => {
    for (const s of FONT_SIZES) {
      const html = `<p><span style="font-size: ${s.value}">text</span></p>`;
      expect(sanitizeArticleHtml(html)).toContain(`font-size: ${s.value}`);
    }
  });

  it('keeps every curated highlight color exactly', () => {
    for (const h of HIGHLIGHT_COLORS) {
      const html = `<p><mark style="background-color: ${h.value}">text</mark></p>`;
      expect(sanitizeArticleHtml(html)).toContain(`background-color: ${h.value}`);
    }
  });

  it('keeps text-align values', () => {
    for (const align of ['left', 'center', 'right', 'justify']) {
      const html = `<p style="text-align: ${align}">text</p>`;
      expect(sanitizeArticleHtml(html)).toContain(`text-align: ${align}`);
    }
  });
});

describe('sanitizeArticleHtml -- strips anything outside the curated set', () => {
  it('strips an arbitrary color not in the curated palette', () => {
    const out = sanitizeArticleHtml('<p><span style="color: #123456">text</span></p>');
    expect(out).not.toContain('#123456');
  });

  it('strips an arbitrary font-size not in the curated scale', () => {
    const out = sanitizeArticleHtml('<p><span style="font-size: 53px">text</span></p>');
    expect(out).not.toContain('53px');
  });

  it('strips a pasted background-color (e.g. from Word/Google Docs)', () => {
    const out = sanitizeArticleHtml('<p><span style="background-color: yellow; font-family: Calibri;">pasted</span></p>');
    expect(out).not.toContain('background-color: yellow');
    expect(out).not.toContain('font-family');
  });
});

describe('sanitizeArticleHtml -- security: unsafe HTML is neutralized', () => {
  it('strips <script> tags entirely, including their content', () => {
    const out = sanitizeArticleHtml('<p>safe</p><script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('strips inline event handler attributes', () => {
    const out = sanitizeArticleHtml('<p onclick="alert(1)">click me</p>');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert(1)');
  });

  it('strips a javascript: link href', () => {
    const out = sanitizeArticleHtml('<p><a href="javascript:alert(1)">link</a></p>');
    expect(out).not.toContain('javascript:');
  });

  it('strips an iframe', () => {
    const out = sanitizeArticleHtml('<p>a</p><iframe src="https://evil.example"></iframe>');
    expect(out).not.toContain('<iframe');
  });

  it('strips a data: URI href', () => {
    const out = sanitizeArticleHtml('<p><a href="data:text/html,<script>alert(1)</script>">link</a></p>');
    expect(out).not.toContain('data:');
  });

  it('strips an unsupported tag (e.g. <svg>) while keeping surrounding safe content', () => {
    const out = sanitizeArticleHtml('<p>before</p><svg onload="alert(1)"></svg><p>after</p>');
    expect(out).not.toContain('<svg');
    expect(out).not.toContain('onload');
    expect(out).toContain('<p>before</p>');
    expect(out).toContain('<p>after</p>');
  });
});

describe('sanitizeArticleHtml -- links', () => {
  it('forces a safe rel and target on every surviving link', () => {
    const out = sanitizeArticleHtml('<p><a href="https://example.com">link</a></p>');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it('keeps a plain https link', () => {
    const out = sanitizeArticleHtml('<p><a href="https://example.com/article">read more</a></p>');
    expect(out).toContain('href="https://example.com/article"');
  });

  it('keeps a mailto link', () => {
    const out = sanitizeArticleHtml('<p><a href="mailto:tips@fyre.co.in">email us</a></p>');
    expect(out).toContain('href="mailto:tips@fyre.co.in"');
  });
});
