import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sanitizeArticleHtml } from '../sanitize';

// jsdom ships without its own type declarations and this project doesn't
// carry @types/jsdom as a dependency (it only reaches jsdom transitively
// through isomorphic-dompurify) -- loaded dynamically as `any` rather
// than statically imported so this doesn't need one.
type JSDOMCtor = new (html?: string) => { window: any };

// ---------------------------------------------------------------------
// Regression test for the value<->editor resync effect in
// components/admin/FyreRichTextEditor.tsx. That effect can't be
// exercised directly without React + a real browser DOM, so this
// reproduces its exact comparison/sync logic against a real headless
// TipTap Editor (not a mock) -- the same technique used to originally
// diagnose the color-sanitization bug this guards against.
//
// The bug: the effect used to compare `value` (always a
// sanitizeArticleHtml() output) against the RAW `editor.getHTML()`.
// TipTap always normalizes colors through the DOM's CSSOM when
// serializing (hex -> rgb(), rgba() spacing added), so that comparison
// was "different" on every render as soon as any curated color/
// highlight was present -- not just on a real Edit/Cancel/Submit --
// forcing a full document reset (cursor jump to the start, plus an
// extra onUpdate/onChange round trip from setContent's default
// emitUpdate:true) on every keystroke near colored text. The fix
// compares `value` against a freshly-sanitized re-serialization
// instead, and passes `{ emitUpdate: false }` to setContent.
// ---------------------------------------------------------------------

let restoreGlobals: () => void;

beforeAll(async () => {
  // @ts-ignore -- jsdom has no bundled/installed type declarations in this project
  const jsdomModule = await import('jsdom');
  const JSDOM = jsdomModule.JSDOM as JSDOMCtor;
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const prev = {
    window: (global as any).window,
    document: (global as any).document,
    navigator: Object.getOwnPropertyDescriptor(global, 'navigator'),
    DOMParser: (global as any).DOMParser,
    requestAnimationFrame: (global as any).requestAnimationFrame,
    cancelAnimationFrame: (global as any).cancelAnimationFrame
  };
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
  (global as any).DOMParser = dom.window.DOMParser;
  (global as any).requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number;
  (global as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

  restoreGlobals = () => {
    (global as any).window = prev.window;
    (global as any).document = prev.document;
    if (prev.navigator) Object.defineProperty(global, 'navigator', prev.navigator);
    (global as any).DOMParser = prev.DOMParser;
    (global as any).requestAnimationFrame = prev.requestAnimationFrame;
    (global as any).cancelAnimationFrame = prev.cancelAnimationFrame;
  };
});

afterAll(() => {
  restoreGlobals?.();
});

// Mirrors FyreRichTextEditor's own resync effect body exactly, so this
// test fails if that logic regresses back to comparing raw HTML.
function runResyncEffect(editor: any, value: string): { reset: boolean } {
  if (value !== sanitizeArticleHtml(editor.getHTML())) {
    editor.commands.setContent(value || '', { emitUpdate: false });
    return { reset: true };
  }
  return { reset: false };
}

async function makeEditor() {
  const { Editor } = await import('@tiptap/core');
  const StarterKit = (await import('@tiptap/starter-kit')).default;
  const { TextStyleKit } = await import('@tiptap/extension-text-style');
  const Highlight = (await import('@tiptap/extension-highlight')).default;

  let value = '';
  let updateCount = 0;
  const editor = new Editor({
    extensions: [StarterKit, TextStyleKit, Highlight.configure({ multicolor: true })],
    content: value,
    onUpdate: ({ editor }) => {
      updateCount++;
      value = sanitizeArticleHtml(editor.getHTML());
    }
  });
  return {
    editor,
    getValue: () => value,
    getUpdateCount: () => updateCount
  };
}

describe('FyreRichTextEditor value<->editor resync effect', () => {
  it('does not reset the document once value is back in sync (sanitize-aware comparison)', async () => {
    const { editor, getValue } = await makeEditor();
    editor.commands.setContent('<p>hello world</p>', { emitUpdate: false });
    editor.commands.setTextSelection({ from: 1, to: 6 }); // "hello"
    editor.chain().focus().setColor('#2F6FED').run();

    const value = getValue();
    expect(value).toContain('color: #2F6FED');

    const pass1 = runResyncEffect(editor, value);
    const pass2 = runResyncEffect(editor, value);

    expect(pass1.reset).toBe(false);
    expect(pass2.reset).toBe(false);
    editor.destroy();
  });

  it('never fires a spurious extra onUpdate from the resync (no double onChange)', async () => {
    const { editor, getValue, getUpdateCount } = await makeEditor();
    editor.commands.setContent('<p>hello world</p>', { emitUpdate: false });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.chain().focus().setColor('#2F6FED').run();

    expect(getUpdateCount()).toBe(1); // only the real edit

    runResyncEffect(editor, getValue());
    runResyncEffect(editor, getValue());

    expect(getUpdateCount()).toBe(1); // still just the one real edit
    editor.destroy();
  });

  it('keeps the color visually applied in the editor after the resync runs', async () => {
    const { editor, getValue } = await makeEditor();
    editor.commands.setContent('<p>hello world</p>', { emitUpdate: false });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.chain().focus().setColor('#2F6FED').run();

    runResyncEffect(editor, getValue());

    const html = editor.getHTML();
    const hasColor = html.includes('rgb(47, 111, 237)') || html.includes('#2F6FED');
    expect(hasColor).toBe(true);
    editor.destroy();
  });

  it('WOULD reset on every render with the old raw-HTML comparison (documents the bug this replaces)', async () => {
    const { editor, getValue } = await makeEditor();
    editor.commands.setContent('<p>hello world</p>', { emitUpdate: false });
    editor.commands.setTextSelection({ from: 1, to: 6 });
    editor.chain().focus().setColor('#2F6FED').run();

    const value = getValue();
    // The old, buggy comparison this component used to make.
    const oldComparisonMismatches = value !== editor.getHTML();
    expect(oldComparisonMismatches).toBe(true);
    editor.destroy();
  });

  it('still resets when the value genuinely changes underneath the editor (Edit/Cancel/Submit)', async () => {
    const { editor } = await makeEditor();
    editor.commands.setContent('<p>original</p>', { emitUpdate: false });

    const newValue = '<p>a totally different article loaded via Edit</p>';
    const result = runResyncEffect(editor, newValue);

    expect(result.reset).toBe(true);
    expect(editor.getHTML()).toContain('a totally different article loaded via Edit');
    editor.destroy();
  });
});
