// Separate test file (rather than a describe block in sanitize.test.ts)
// because it needs isomorphic-dompurify mocked at the module level --
// DOMPurify's own `sanitize` export is a non-configurable getter
// (confirmed via Object.getOwnPropertyDescriptor), so vi.spyOn can't
// stub it in place. Mocking the whole module here, in its own file,
// keeps sanitize.test.ts free to exercise the real DOMPurify behaviour.
import { describe, it, expect, vi } from 'vitest';

vi.mock('isomorphic-dompurify', () => ({
  default: {
    addHook: vi.fn(),
    sanitize: vi.fn(() => {
      throw new Error('simulated jsdom failure');
    })
  }
}));

describe('sanitizeArticleHtml -- fails safe if DOMPurify itself throws', () => {
  it('falls back to escaped plain text instead of crashing the page', async () => {
    const { sanitizeArticleHtml } = await import('../sanitize');
    const out = sanitizeArticleHtml('<p>Some <strong>real</strong> article text & a stray <tag>.</p>');
    expect(out).toBe('<p>Some real article text &amp; a stray .</p>');
  });

  it('never leaks the original unsanitized HTML through the fallback', async () => {
    const { sanitizeArticleHtml } = await import('../sanitize');
    const out = sanitizeArticleHtml('<p onclick="evil()">hi</p><script>alert(1)</script>');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('evil(');
  });

  it('returns an empty string for content that is only tags once stripped', async () => {
    const { sanitizeArticleHtml } = await import('../sanitize');
    expect(sanitizeArticleHtml('<hr><br>')).toBe('');
  });
});
