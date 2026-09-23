// Curated formatting options for the article rich-text editor
// (components/admin/FyreRichTextEditor.tsx) -- the single source of truth
// for every color/size an admin can apply, and also what
// lib/richText/sanitize.ts allows through when re-sanitizing stored HTML
// before it's rendered. An admin never gets a raw color/size input (no
// <input type="color">, no free-typed px value): every button in the
// toolbar calls setColor/setFontSize/setHighlight with one of the exact
// values listed here, so the HTML this editor can ever produce is
// naturally limited to this set -- and the sanitizer then double-checks
// that at render time, so the two can't quietly drift apart (whichever
// changes, both read from here).
//
// Every hex value below is an existing Fyre design token (see
// tailwind.config.js), not a new color invented for the editor -- an
// admin choosing "Fyre blue" text gets the exact same blue as the rest
// of the site.
export const TEXT_COLORS = [
  { label: 'Primary white', value: '#F2F3F5' }, // text
  { label: 'Secondary gray', value: 'rgba(255,255,255,0.62)' }, // textDim
  { label: 'Muted gray', value: 'rgba(255,255,255,0.38)' }, // textFaint
  { label: 'Fyre blue', value: '#2F6FED' }, // gold
  { label: 'Light Fyre blue', value: '#5B93FF' }, // goldBright
  { label: 'Success green', value: '#22C55E' }, // goldDim
  { label: 'Warning amber', value: '#F59E0B' }, // amber
  { label: 'Danger red', value: '#EF4444' } // red
] as const;

// Low-alpha tints over the dark article background -- readable with any
// of the text colors above sitting on top, unlike a solid highlight
// would be.
export const HIGHLIGHT_COLORS = [
  { label: 'Blue', value: 'rgba(47,111,237,0.25)' },
  { label: 'Green', value: 'rgba(34,197,94,0.25)' },
  { label: 'Amber', value: 'rgba(245,158,11,0.25)' },
  { label: 'Red', value: 'rgba(239,68,68,0.25)' }
] as const;

// Rem-based, matching the site's own type scale rather than arbitrary
// px. "Normal" isn't in this list on purpose -- selecting it clears the
// font-size mark entirely (editor.commands.unsetFontSize()) so a normal
// paragraph carries no inline style at all, the common case staying
// clean semantic HTML.
export const FONT_SIZES = [
  { label: 'Small', value: '0.8125rem' },
  { label: 'Medium', value: '1.125rem' },
  { label: 'Large', value: '1.375rem' },
  { label: 'Extra Large', value: '1.75rem' }
] as const;

export const TEXT_COLOR_VALUES = TEXT_COLORS.map((c) => c.value);
export const HIGHLIGHT_COLOR_VALUES = HIGHLIGHT_COLORS.map((c) => c.value);
export const FONT_SIZE_VALUES = FONT_SIZES.map((s) => s.value);
