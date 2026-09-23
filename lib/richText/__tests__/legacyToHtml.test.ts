import { describe, it, expect } from 'vitest';
import { legacyContentToHtml } from '../legacyToHtml';
import { sanitizeArticleHtml } from '../sanitize';

describe('legacyContentToHtml -- converting an old plain-text article for editing', () => {
  it('wraps a single paragraph', () => {
    expect(legacyContentToHtml('Hello world.')).toBe('<p>Hello world.</p>');
  });

  it('preserves blank-line-separated paragraph breaks (the one thing a raw HTML parser would collapse)', () => {
    const legacy = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    expect(legacyContentToHtml(legacy)).toBe('<p>First paragraph.</p><p>Second paragraph.</p><p>Third paragraph.</p>');
  });

  it('converts an embedded markdown table (as produced by the old TableBuilder) into a real <table>', () => {
    const legacy = 'Before the table.\n\n| Film | Gross |\n|---|---|\n| A | 100cr |\n| B | 50cr |\n\nAfter the table.';
    const html = legacyContentToHtml(legacy);
    expect(html).toBe(
      '<p>Before the table.</p>' +
        '<table><thead><tr><th>Film</th><th>Gross</th></tr></thead>' +
        '<tbody><tr><td>A</td><td>100cr</td></tr><tr><td>B</td><td>50cr</td></tr></tbody></table>' +
        '<p>After the table.</p>'
    );
  });

  it('HTML-escapes special characters in plain text so they render as text, not markup', () => {
    const html = legacyContentToHtml('Box office < expectations, but > last week & still trending.');
    expect(html).toBe('<p>Box office &lt; expectations, but &gt; last week &amp; still trending.</p>');
  });

  it('escapes a literal "<script>" someone once typed as plain text, rather than reviving it as a tag', () => {
    const html = legacyContentToHtml('Reported "<script>alert(1)</script>" as a joke in the article text.');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    // and it stays inert even after going through the sanitizer too
    expect(sanitizeArticleHtml(html)).not.toContain('<script>alert');
  });

  it('round-trips through sanitizeArticleHtml unchanged (a legacy article opened for editing is already safe HTML)', () => {
    const legacy = 'Para one.\n\nPara two.';
    const html = legacyContentToHtml(legacy);
    expect(sanitizeArticleHtml(html)).toBe(html);
  });
});
