'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  ChevronDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Link2,
  Link2Off,
  Table2,
  Minus,
  Eraser,
  Baseline,
  Highlighter,
  Type,
  Plus,
  Trash2,
  Rows3,
  Columns3
} from 'lucide-react';
import { TEXT_COLORS, HIGHLIGHT_COLORS, FONT_SIZES } from '@/lib/richText/tokens';
import { sanitizeArticleHtml } from '@/lib/richText/sanitize';

// ---------------------------------------------------------------------
// FyreRichTextEditor -- the one editor both Admin > News and Admin >
// Reviews use for their "Full article"/"Full review" field (app/admin/
// page.tsx wires it in for any field of kind 'richtext'). Built on
// TipTap/ProseMirror rather than a plain textarea because this is the
// one field on the site that genuinely needs headings/emphasis/lists/
// links/tables, and TipTap was the clear fit against every requirement
// this needed to satisfy: React-native (@tiptap/react), actively
// maintained (v3), outputs clean semantic HTML via editor.getHTML() (no
// proprietary JSON format to store), ships table support as a first-
// party extension, and every formatting choice funnels through a
// curated toolbar rather than free-form styling -- so the HTML it
// produces is exactly what lib/richText/sanitize.ts already expects,
// not a moving target. Every extension below is an official @tiptap/*
// package; nothing third-party.
//
// Colors, highlight tints and font sizes are never free-typed -- they
// come from lib/richText/tokens.ts, the same file the sanitizer
// validates against, so the editor can never produce HTML its own
// sanitizer would then strip.
// ---------------------------------------------------------------------

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex items-center justify-center w-8 h-8 rounded-lg transition ${
        active ? 'bg-gold/[0.16] text-gold' : 'text-textDim hover:bg-white/[0.06] hover:text-text'
      } ${disabled ? 'opacity-30 pointer-events-none' : ''}`}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="w-px h-6 bg-border mx-1 flex-none" />;
}

function ToolbarMenu({
  label,
  icon,
  width = 'w-44',
  children
}: {
  label: string;
  icon: React.ReactNode;
  width?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1 h-8 px-2 rounded-lg text-xs font-medium text-textDim hover:bg-white/[0.06] hover:text-text transition"
      >
        {icon}
        {label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className={`absolute z-40 left-0 mt-1.5 ${width} bg-surfaceHigh border border-border rounded-xl shadow-card py-1.5`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 text-sm px-3.5 py-2 text-left transition ${
        active ? 'bg-gold/[0.1] text-gold font-semibold' : 'text-textDim hover:bg-white/[0.06] hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

const TEXT_STYLE_ITEMS = [
  { key: 'normal', label: 'Normal text' },
  { key: 'small', label: 'Small text' },
  { key: 'lead', label: 'Lead / Large text' },
  { key: 'h2', label: 'Heading 2' },
  { key: 'h3', label: 'Heading 3' },
  { key: 'h4', label: 'Heading 4' },
  { key: 'quote', label: 'Quote' }
] as const;

function activeTextStyleKey(editor: Editor): (typeof TEXT_STYLE_ITEMS)[number]['key'] {
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  if (editor.isActive('heading', { level: 4 })) return 'h4';
  if (editor.isActive('blockquote')) return 'quote';
  if (editor.isActive('textStyle', { fontSize: FONT_SIZES[0].value })) return 'small';
  if (editor.isActive('textStyle', { fontSize: FONT_SIZES[2].value })) return 'lead';
  return 'normal';
}

function applyTextStyle(editor: Editor, key: (typeof TEXT_STYLE_ITEMS)[number]['key']) {
  const chain = editor.chain().focus();
  if (key === 'h2') return chain.setNode('heading', { level: 2 }).run();
  if (key === 'h3') return chain.setNode('heading', { level: 3 }).run();
  if (key === 'h4') return chain.setNode('heading', { level: 4 }).run();
  if (key === 'quote') return chain.setBlockquote().run();
  // Normal/Small/Lead are all plain paragraphs -- they only differ by
  // which (if any) curated font size is applied on top.
  chain.setParagraph();
  if (key === 'small') chain.setFontSize(FONT_SIZES[0].value);
  else if (key === 'lead') chain.setFontSize(FONT_SIZES[2].value);
  else chain.unsetFontSize();
  chain.run();
}

function Toolbar({ editor }: { editor: Editor }) {
  const linkPopover = useDropdown();
  const [linkUrl, setLinkUrl] = useState('');
  const tablePopover = useDropdown();

  function openLinkPopover() {
    setLinkUrl(editor.getAttributes('link').href ?? '');
    linkPopover.setOpen(true);
  }

  function applyLink() {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    linkPopover.setOpen(false);
  }

  const inTable = editor.isActive('table');

  return (
    <div className="flex flex-wrap items-center gap-0.5 bg-surfaceHigh border border-border border-b-0 rounded-t-xl px-2 py-1.5">
      <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarMenu label={TEXT_STYLE_ITEMS.find((i) => i.key === activeTextStyleKey(editor))!.label} icon={<Type size={14} />} width="w-48">
        {(close) => (
          <>
            {TEXT_STYLE_ITEMS.map((item) => (
              <MenuItem
                key={item.key}
                active={activeTextStyleKey(editor) === item.key}
                onClick={() => {
                  applyTextStyle(editor, item.key);
                  close();
                }}
              >
                {item.label}
              </MenuItem>
            ))}
          </>
        )}
      </ToolbarMenu>

      <ToolbarMenu label="Size" icon={<span className="text-[11px] font-bold">A</span>} width="w-36">
        {(close) => (
          <>
            <MenuItem
              active={!editor.isActive('textStyle', { fontSize: undefined }) && !FONT_SIZES.some((s) => editor.isActive('textStyle', { fontSize: s.value }))}
              onClick={() => {
                editor.chain().focus().unsetFontSize().run();
                close();
              }}
            >
              Normal
            </MenuItem>
            {FONT_SIZES.map((s) => (
              <MenuItem
                key={s.value}
                active={editor.isActive('textStyle', { fontSize: s.value })}
                onClick={() => {
                  editor.chain().focus().setFontSize(s.value).run();
                  close();
                }}
              >
                {s.label}
              </MenuItem>
            ))}
          </>
        )}
      </ToolbarMenu>

      <ToolbarSeparator />

      <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={16} />
      </ToolbarButton>
      <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarMenu label="Color" icon={<Baseline size={14} />} width="w-40">
        {(close) => (
          <>
            {TEXT_COLORS.map((c) => (
              <MenuItem
                key={c.value}
                active={editor.isActive('textStyle', { color: c.value })}
                onClick={() => {
                  editor.chain().focus().setColor(c.value).run();
                  close();
                }}
              >
                <span className="w-3.5 h-3.5 rounded-full flex-none border border-white/20" style={{ backgroundColor: c.value }} />
                {c.label}
              </MenuItem>
            ))}
            <div className="h-px bg-border my-1.5 mx-3.5" />
            <MenuItem
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                close();
              }}
            >
              Reset color
            </MenuItem>
          </>
        )}
      </ToolbarMenu>

      <ToolbarMenu label="Highlight" icon={<Highlighter size={14} />} width="w-40">
        {(close) => (
          <>
            {HIGHLIGHT_COLORS.map((c) => (
              <MenuItem
                key={c.value}
                active={editor.isActive('highlight', { color: c.value })}
                onClick={() => {
                  editor.chain().focus().toggleHighlight({ color: c.value }).run();
                  close();
                }}
              >
                <span className="w-3.5 h-3.5 rounded-full flex-none border border-white/20" style={{ backgroundColor: c.value }} />
                {c.label}
              </MenuItem>
            ))}
            <div className="h-px bg-border my-1.5 mx-3.5" />
            <MenuItem
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                close();
              }}
            >
              Remove highlight
            </MenuItem>
          </>
        )}
      </ToolbarMenu>

      <ToolbarSeparator />

      <ToolbarMenu
        label="Align"
        icon={
          editor.isActive({ textAlign: 'center' }) ? (
            <AlignCenter size={14} />
          ) : editor.isActive({ textAlign: 'right' }) ? (
            <AlignRight size={14} />
          ) : editor.isActive({ textAlign: 'justify' }) ? (
            <AlignJustify size={14} />
          ) : (
            <AlignLeft size={14} />
          )
        }
        width="w-32"
      >
        {(close) => (
          <>
            {(
              [
                ['left', 'Left', AlignLeft],
                ['center', 'Center', AlignCenter],
                ['right', 'Right', AlignRight],
                ['justify', 'Justify', AlignJustify]
              ] as const
            ).map(([value, label, Icon]) => (
              <MenuItem
                key={value}
                active={editor.isActive({ textAlign: value })}
                onClick={() => {
                  editor.chain().focus().setTextAlign(value).run();
                  close();
                }}
              >
                <Icon size={14} />
                {label}
              </MenuItem>
            ))}
          </>
        )}
      </ToolbarMenu>

      <ToolbarButton title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      <div ref={linkPopover.ref} className="relative">
        <ToolbarButton title="Insert link" active={editor.isActive('link')} onClick={openLinkPopover}>
          <Link2 size={16} />
        </ToolbarButton>
        {linkPopover.open && (
          <div className="absolute z-40 left-0 mt-1.5 w-64 bg-surfaceHigh border border-border rounded-xl shadow-card p-3 flex flex-col gap-2">
            <input
              autoFocus
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyLink();
                }
              }}
              placeholder="https://…"
              className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-text"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => linkPopover.setOpen(false)}
                className="text-xs text-textFaint hover:text-textDim px-2 py-1"
              >
                Cancel
              </button>
              <button type="button" onClick={applyLink} className="text-xs font-semibold text-gold hover:text-goldBright px-2 py-1">
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
      <ToolbarButton title="Remove link" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()}>
        <Link2Off size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      <div ref={tablePopover.ref} className="relative">
        <ToolbarButton title="Table" active={inTable} onClick={() => tablePopover.setOpen((v) => !v)}>
          <Table2 size={16} />
        </ToolbarButton>
        {tablePopover.open && (
          <div className="absolute z-40 left-0 mt-1.5 w-52 bg-surfaceHigh border border-border rounded-xl shadow-card py-1.5">
            {!inTable ? (
              <MenuItem
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                  tablePopover.setOpen(false);
                }}
              >
                <Plus size={14} />
                Insert table (3×3)
              </MenuItem>
            ) : (
              <>
                <MenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                  <Rows3 size={14} />
                  Add row
                </MenuItem>
                <MenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                  <Trash2 size={14} />
                  Remove row
                </MenuItem>
                <MenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                  <Columns3 size={14} />
                  Add column
                </MenuItem>
                <MenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                  <Trash2 size={14} />
                  Remove column
                </MenuItem>
                <MenuItem active={editor.isActive('tableHeader')} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
                  <Rows3 size={14} />
                  Header row
                </MenuItem>
                <div className="h-px bg-border my-1.5 mx-3.5" />
                <MenuItem
                  onClick={() => {
                    editor.chain().focus().deleteTable().run();
                    tablePopover.setOpen(false);
                  }}
                >
                  <Trash2 size={14} />
                  Delete table
                </MenuItem>
              </>
            )}
          </div>
        )}
      </div>

      <ToolbarButton title="Horizontal divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={16} />
      </ToolbarButton>

      <ToolbarSeparator />

      <ToolbarButton
        title="Clear formatting"
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
      >
        <Eraser size={16} />
      </ToolbarButton>
    </div>
  );
}

export default function FyreRichTextEditor({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' }
        }
      }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['paragraph', 'heading'] }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write the article…' })
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'fyre-article fyre-editor-content min-h-[280px] px-4 py-3.5 text-sm focus:outline-none'
      }
    },
    onUpdate: ({ editor }) => {
      onChange(sanitizeArticleHtml(editor.getHTML()));
    }
  });

  // The `value` prop changes out from under an already-mounted editor
  // when the admin clicks "Edit" on an existing article (or "Cancel
  // edit"/successful-submit resets it to '') -- TipTap's `content`
  // option only seeds the editor once at mount, so those transitions
  // need an explicit setContent. Guarded on an actual difference so this
  // doesn't fight the onUpdate above in a loop.
  //
  // That guard has to compare against a SANITIZED serialization, not
  // editor.getHTML() directly: `value` is always the sanitizer's output
  // (onChange below always sends sanitizeArticleHtml(...), and the
  // initial value loaded from Supabase was sanitized before it was ever
  // saved), while editor.getHTML() normalizes every color through the
  // browser's CSSOM (hex -> rgb(), rgba() spacing added) -- the same
  // format drift lib/richText/sanitize.ts's colorValuesMatch() exists to
  // paper over. Comparing the raw strings meant this effect saw a "real"
  // difference on every render as soon as any curated color/highlight
  // was present -- not just after an actual Edit/Cancel/Submit -- and
  // reset the whole document (moving the cursor to the start) on every
  // single keystroke near colored text, which is exactly what looked
  // like "the color isn't sticking".
  useEffect(() => {
    if (!editor) return;
    if (value !== sanitizeArticleHtml(editor.getHTML())) {
      // emitUpdate: false -- this sync is echoing `value` back into the
      // editor, not a new edit; without this, setContent's default
      // (emitUpdate: true) fires onUpdate again, which re-sanitizes and
      // calls onChange a second time for the same content.
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col">
      <Toolbar editor={editor} />
      <div className="bg-bg border border-border rounded-b-xl">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
