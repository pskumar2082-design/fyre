'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { Card } from '@/components/ui';
import TableBuilder from '@/components/admin/TableBuilder';
import SocialPosterTool from '@/components/admin/SocialPosterTool';
import FyreRichTextEditor from '@/components/admin/FyreRichTextEditor';
import ArticleBody from '@/components/ArticleBody';
import { sanitizeArticleHtml } from '@/lib/richText/sanitize';
import { legacyContentToHtml } from '@/lib/richText/legacyToHtml';

// ---------------------------------------------------------------------------
// Section config: this is "the News admin pattern" generalized so the same
// load / submit / delete / image-upload logic and the same form + list UI
// drive all six tables in supabase/schema.sql, instead of six near-identical
// copies of the Dashboard component. Add a new table here and it gets a full
// admin tab for free.
// ---------------------------------------------------------------------------

type Field =
  | { key: string; label: string; kind: 'text'; required?: boolean; placeholder: string }
  | {
      key: string;
      label: string;
      kind: 'textarea';
      required?: boolean;
      placeholder: string;
      rows: number;
      // shows a "+ Insert table" button under this field that opens a small
      // grid builder (components/admin/TableBuilder.tsx) and drops the
      // resulting markdown table in at the cursor -- for a field whose
      // rendered page (ArticleBody) knows how to turn a pipe-table block
      // back into a styled table, i.e. news/reviews' `content`.
      allowTableInsert?: boolean;
    }
  // A full FyreRichTextEditor (components/admin/FyreRichTextEditor.tsx)
  // instead of a plain textarea -- for news/reviews' `content`, the one
  // field that needed real formatting. Sanitized (lib/richText/sanitize.ts)
  // on every edit inside the editor itself, again in handleSubmit right
  // before it's written to Supabase, and a third time in ArticleBody right
  // before it's ever rendered on the public site -- see that file's own
  // comment for why a third, render-time pass matters even though the
  // first two already ran.
  | { key: string; label: string; kind: 'richtext'; required?: boolean; placeholder?: string }
  | { key: string; label: string; kind: 'select'; required?: boolean; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: 'number'; required?: boolean; placeholder: string; step?: string }
  | { key: string; label: string; kind: 'date'; required?: boolean }
  // a dropdown whose options are loaded at runtime from another table (a
  // lightweight foreign key — e.g. picking which movie a breakdown row belongs to)
  | { key: string; label: string; kind: 'reference'; required?: boolean; refTable: string; refLabelColumn: string };

type SectionConfig = {
  key: string;
  table: string;
  label: string;
  fields: Field[];
  autoDate?: boolean; // stamps this table's `date` text column with today's date on every save
  hasImage?: boolean; // set false for tables with no image_url column (default true)
  orderBy: { column: string; ascending: boolean };
  primary: (item: any) => string;
  secondary: (item: any) => string;
};

const SECTIONS: SectionConfig[] = [
  {
    key: 'news',
    table: 'news',
    label: 'News',
    autoDate: true,
    orderBy: { column: 'created_at', ascending: false },
    fields: [
      {
        key: 'category',
        label: 'Category',
        kind: 'select',
        options: [
          { value: 'news', label: 'Movie news' },
          { value: 'boxoffice', label: 'Box office' },
          { value: 'ott', label: 'OTT' },
          { value: 'gallery', label: 'Gallery' }
        ]
      },
      { key: 'title', label: 'Headline', kind: 'text', required: true, placeholder: 'Headline' },
      {
        key: 'excerpt',
        label: 'Short summary',
        kind: 'textarea',
        rows: 2,
        placeholder: 'Short summary shown on the card'
      },
      {
        key: 'content',
        label: 'Full article',
        kind: 'richtext',
        placeholder: 'Write the full article…'
      }
    ],
    primary: (n) => n.title,
    secondary: (n) => `${n.date ?? ''} · ${n.category ?? ''}`
  },
  {
    key: 'reviews',
    table: 'reviews',
    label: 'Reviews',
    autoDate: true,
    orderBy: { column: 'created_at', ascending: false },
    fields: [
      { key: 'title', label: 'Headline', kind: 'text', required: true, placeholder: 'Headline' },
      {
        key: 'excerpt',
        label: 'Short summary',
        kind: 'textarea',
        rows: 2,
        placeholder: 'Short summary shown on the card'
      },
      {
        key: 'content',
        label: 'Full review',
        kind: 'richtext',
        placeholder: 'Write the full review…'
      },
      {
        key: 'rating',
        label: 'Rating',
        kind: 'select',
        options: [
          { value: '1', label: '1 / 5' },
          { value: '2', label: '2 / 5' },
          { value: '3', label: '3 / 5' },
          { value: '4', label: '4 / 5' },
          { value: '5', label: '5 / 5' }
        ]
      }
    ],
    primary: (r) => r.title,
    secondary: (r) => `${r.date ?? ''} · ${r.rating}/5`
  },
  {
    key: 'live_box_office',
    table: 'live_box_office',
    label: 'Live box office',
    orderBy: { column: 'created_at', ascending: false },
    fields: [
      { key: 'title', label: 'Movie title', kind: 'text', required: true, placeholder: 'Movie title' },
      { key: 'sub', label: 'Subtitle', kind: 'text', placeholder: 'Subtitle (e.g. Live, Day 3, Worldwide)' },
      {
        key: 'amt',
        label: 'Amount (₹ Cr)',
        kind: 'number',
        required: true,
        placeholder: 'Amount in ₹ crore, e.g. 42.5',
        step: '0.01'
      }
    ],
    primary: (m) => m.title,
    secondary: (m) => `${m.sub ?? ''} · ₹${Number(m.amt).toFixed(1)} Cr`
  },
  {
    key: 'now_showing',
    table: 'now_showing',
    label: 'Now showing',
    orderBy: { column: 'created_at', ascending: false },
    fields: [
      { key: 'title', label: 'Movie title', kind: 'text', required: true, placeholder: 'Movie title' },
      { key: 'status', label: 'Status badge', kind: 'text', placeholder: 'Status badge (e.g. Hit, Blockbuster)' },
      { key: 'amt', label: 'Collection text', kind: 'text', placeholder: 'Collection text shown under title (e.g. ₹120 Cr)' },
      { key: 'release_date', label: 'Release date', kind: 'date' },
      { key: 'language', label: 'Language', kind: 'text', placeholder: 'Language (e.g. Hindi, Telugu)' },
      { key: 'genre', label: 'Genre', kind: 'text', placeholder: 'Genre (e.g. Family, Action)' },
      { key: 'lifetime_gross', label: 'Lifetime gross', kind: 'text', placeholder: 'Lifetime gross (e.g. ₹308.13 Cr)' },
      { key: 'lifetime_tickets', label: 'Lifetime tickets', kind: 'text', placeholder: 'Lifetime tickets (e.g. 1.30 Cr)' },
      { key: 'lifetime_shows', label: 'Lifetime shows', kind: 'text', placeholder: 'Lifetime shows (e.g. 1.79 L)' },
      { key: 'cities', label: 'Cities', kind: 'number', placeholder: 'Number of cities showing' },
      {
        key: 'lifetime_occupancy',
        label: 'Lifetime occupancy %',
        kind: 'number',
        placeholder: 'Occupancy percentage, e.g. 36.9',
        step: '0.1'
      },
      // Advance = pre-release booking numbers, shown on the movie page when
      // the "Advance" side of the Advance/Tracked toggle is selected.
      { key: 'advance_gross', label: 'Advance gross', kind: 'text', placeholder: 'Advance booking gross (e.g. ₹4.65 Cr)' },
      { key: 'advance_tickets', label: 'Advance tickets sold', kind: 'text', placeholder: 'Advance tickets sold (e.g. 1.9 L)' },
      { key: 'advance_shows', label: 'Advance shows', kind: 'text', placeholder: 'Advance shows (e.g. 6.4 K)' },
      { key: 'advance_cities', label: 'Advance cities', kind: 'number', placeholder: 'Number of cities with advance bookings' },
      {
        key: 'advance_occupancy',
        label: 'Advance occupancy %',
        kind: 'number',
        placeholder: 'Advance occupancy percentage, e.g. 18.4',
        step: '0.1'
      }
    ],
    // Same-titled movies (a dubbed re-release, a same-named remake) are
    // easy to mix up in this list, so the release year rides along with
    // the title here too.
    primary: (m) => (m.release_date ? `${m.title} (${new Date(m.release_date).getFullYear()})` : m.title),
    secondary: (m) => `${m.status ?? ''} · ${m.amt ?? ''}`
  },
  {
    key: 'box_office_breakdown',
    table: 'box_office_breakdown',
    label: 'Box office breakdown',
    hasImage: false,
    orderBy: { column: 'day_date', ascending: false },
    fields: [
      { key: 'movie_id', label: 'Movie', kind: 'reference', required: true, refTable: 'now_showing', refLabelColumn: 'title' },
      {
        key: 'kind',
        label: 'Kind',
        kind: 'select',
        options: [
          { value: 'tracked', label: 'Tracked (post-release)' },
          { value: 'advance', label: 'Advance (pre-release booking)' }
        ]
      },
      {
        key: 'breakdown_type',
        label: 'Breakdown type',
        kind: 'select',
        options: [
          { value: 'state', label: 'State wise' },
          { value: 'language', label: 'Language wise' },
          { value: 'format', label: 'Format wise' }
        ]
      },
      { key: 'label', label: 'State / language / format name', kind: 'text', required: true, placeholder: 'e.g. Uttar Pradesh, Hindi, or IMAX' },
      { key: 'day_date', label: 'Date', kind: 'date', required: true },
      { key: 'gross', label: 'Gross (₹ Cr)', kind: 'number', required: true, placeholder: 'Gross in ₹ crore, e.g. 1.18', step: '0.01' },
      { key: 'shows', label: 'Shows', kind: 'number', placeholder: 'Number of shows' },
      { key: 'tickets_sold', label: 'Tickets sold', kind: 'number', placeholder: 'Tickets sold' },
      { key: 'ff', label: 'FF', kind: 'number', placeholder: 'FF' },
      { key: 'sold_out', label: 'Sold out shows', kind: 'number', placeholder: 'Sold out shows' },
      { key: 'occ_pct', label: 'Occupancy %', kind: 'number', placeholder: 'Occupancy percentage, e.g. 19.04', step: '0.01' }
    ],
    primary: (b) => `${b.label} — ${b.day_date}`,
    secondary: (b) =>
      `${b.movie_id_label ?? 'Unknown movie'} · ${b.kind ?? 'tracked'} · ${b.breakdown_type} · ₹${Number(b.gross).toFixed(2)} Cr`
  },
  {
    key: 'upcoming',
    table: 'upcoming',
    label: 'Upcoming',
    orderBy: { column: 'release_date', ascending: true },
    fields: [
      { key: 'title', label: 'Movie title', kind: 'text', required: true, placeholder: 'Movie title' },
      { key: 'release_date', label: 'Release date', kind: 'date', required: true }
    ],
    primary: (u) => u.title,
    secondary: (u) => u.release_date ?? ''
  }
];

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="max-w-md mx-auto px-5 py-16 text-textFaint">Loading…</div>;
  if (!session) return <SignIn />;
  return <AdminShell />;
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  return (
    <div className="max-w-sm mx-auto px-5 py-20">
      <h1 className="hdisplay gtext text-2xl mb-6">fyre admin</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm"
          required
        />
        {error && <p className="text-red text-xs">{error}</p>}
        <button type="submit" className="bg-gold text-white font-semibold rounded-lg py-2.5 text-sm">
          Sign in
        </button>
      </form>
      <p className="text-textFaint text-xs mt-4">
        Create your admin account once in Supabase: Authentication → Users → Add user.
      </p>
    </div>
  );
}

const SOCIAL_POSTER_KEY = 'social-poster';

function AdminShell() {
  const [activeKey, setActiveKey] = useState<string>(SECTIONS[0].key);
  const active = SECTIONS.find((s) => s.key === activeKey) ?? null;

  return (
    <div className="px-5 md:px-10 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="hdisplay gtext text-2xl">fyre admin</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-textFaint border border-border rounded-full px-3 py-1.5"
        >
          Sign out
        </button>
      </div>

      <div className="flex gap-6 flex-wrap mb-6 border-b border-border overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveKey(s.key)}
            className={`text-sm font-medium pb-3 border-b-[3px] -mb-px transition whitespace-nowrap ${
              s.key === activeKey
                ? 'text-gold border-gold'
                : 'text-textFaint border-transparent hover:text-gold'
            }`}
          >
            {s.label}
          </button>
        ))}
        {/* Not a Supabase table like the tabs above -- generates a branded,
            shareable poster image on demand from a TrackTollywood movie's
            own live data, for posting a box-office update on X/etc. See
            components/admin/SocialPosterTool.tsx and
            app/api/social-poster/[slug]/route.tsx. */}
        <button
          onClick={() => setActiveKey(SOCIAL_POSTER_KEY)}
          className={`text-sm font-medium pb-3 border-b-[3px] -mb-px transition whitespace-nowrap ${
            activeKey === SOCIAL_POSTER_KEY
              ? 'text-gold border-gold'
              : 'text-textFaint border-transparent hover:text-gold'
          }`}
        >
          Social poster
        </button>
      </div>

      {/* key={active.key} remounts the Dashboard on tab switch, which resets
          all its form/list state for free instead of a manual reset effect. */}
      {active ? <Dashboard key={active.key} section={active} /> : <SocialPosterTool />}
    </div>
  );
}

function emptyForm(section: SectionConfig): Record<string, string> {
  const form: Record<string, string> = {};
  for (const field of section.fields) {
    if (field.kind === 'select') {
      form[field.key] = field.options[0]?.value ?? '';
    } else {
      form[field.key] = '';
    }
  }
  return form;
}

function Dashboard({ section }: { section: SectionConfig }) {
  const [items, setItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() => emptyForm(section));
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  // options for any 'reference' fields (e.g. Movie picker), keyed by field.key
  const [refOptions, setRefOptions] = useState<Record<string, { id: string; label: string }[]>>({});
  // which allowTableInsert textarea currently has the table builder open
  // (null = closed); the ref map lets the builder insert its markdown at
  // that field's actual cursor position rather than always appending.
  const [tableBuilderFor, setTableBuilderFor] = useState<string | null>(null);

  // Which richtext fields currently show the rendered public preview
  // instead of the live editor (see the Preview button below --
  // section 21 asks that Preview reuse the actual public article
  // styles rather than approximate them, so this literally renders
  // the same <ArticleBody> the public site uses).
  const [previewFields, setPreviewFields] = useState<Set<string>>(new Set());
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const referenceFields = section.fields.filter((f): f is Extract<Field, { kind: 'reference' }> => f.kind === 'reference');

  async function loadItems() {
    const { data } = await supabase
      .from(section.table)
      .select('*')
      .order(section.orderBy.column, { ascending: section.orderBy.ascending });
    let rows = data ?? [];

    // enrich rows with a human-readable label for each reference field, e.g.
    // box_office_breakdown.movie_id -> movie_id_label = "Veera Simham"
    for (const field of referenceFields) {
      const ids = Array.from(new Set(rows.map((r: any) => r[field.key]).filter(Boolean)));
      if (ids.length > 0) {
        const { data: refRows } = await supabase.from(field.refTable).select(`id, ${field.refLabelColumn}`).in('id', ids);
        const labelMap = new Map((refRows ?? []).map((r: any) => [r.id, r[field.refLabelColumn]]));
        rows = rows.map((r: any) => ({ ...r, [`${field.key}_label`]: labelMap.get(r[field.key]) ?? '' }));
      }
    }
    setItems(rows);
  }

  useEffect(() => {
    loadItems();

    async function loadRefOptions() {
      const opts: Record<string, { id: string; label: string }[]> = {};
      for (const field of referenceFields) {
        const { data } = await supabase.from(field.refTable).select(`id, ${field.refLabelColumn}`).order(field.refLabelColumn);
        opts[field.key] = (data ?? []).map((r: any) => ({ id: r.id, label: r[field.refLabelColumn] }));
      }
      setRefOptions(opts);
    }
    loadRefOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File) {
    setUploading(true);
    setError('');
    const path = `${section.key}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('images').upload(path, file);
    setUploading(false);
    if (upErr) {
      setError('Upload failed: ' + upErr.message);
      return;
    }
    const { data } = supabase.storage.from('images').getPublicUrl(path);
    setImageUrl(data.publicUrl);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm(section));
    setImageUrl('');
  }

  function startEdit(item: any) {
    setEditingId(item.id);
    const next: Record<string, string> = {};
    for (const field of section.fields) {
      const raw = item[field.key];
      const value = raw === null || raw === undefined ? '' : String(raw);
      // A richtext field's value must always be HTML by the time it
      // reaches FyreRichTextEditor -- an old plain-text article (see
      // lib/richText/legacyToHtml.ts) gets converted here, once, only in
      // memory for this edit session; nothing is written back until (and
      // unless) the admin actually saves. Anything already HTML, or any
      // other field kind, passes through unchanged. sanitizeArticleHtml
      // is also re-applied here as a load-time safety net, independent of
      // the save-time and render-time passes (see FyreRichTextEditor's
      // and ArticleBody's own comments) -- so even a record edited
      // directly in Supabase, bypassing this admin form entirely, can't
      // load unsafe HTML into the editor.
      if (field.kind === 'richtext' && value) {
        const html = /^\s*<(p|h2|h3|h4|ul|ol|blockquote|table|hr)[\s>]/i.test(value)
          ? value
          : legacyContentToHtml(value);
        next[field.key] = sanitizeArticleHtml(html);
      } else {
        next[field.key] = value;
      }
    }
    setForm(next);
    setImageUrl(item.image_url || '');
  }

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Drops `markdown` into the given textarea field at wherever the cursor
  // currently is (falls back to appending at the end if the textarea hasn't
  // mounted yet), wrapped in blank lines on each side so it lands as its own
  // block -- exactly what ArticleBody's paragraph split expects, whether the
  // cursor was mid-paragraph, at the very start, or at the end of existing
  // text.
  function insertAtCursor(fieldKey: string, markdown: string) {
    const current = form[fieldKey] ?? '';
    const el = textareaRefs.current[fieldKey];
    if (!el) {
      setField(fieldKey, current ? `${current}\n\n${markdown}\n\n` : `${markdown}\n\n`);
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const before = current.slice(0, start);
    const after = current.slice(end);
    const next = `${before}\n\n${markdown}\n\n${after}`;
    setField(fieldKey, next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = (before + `\n\n${markdown}\n\n`).length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const missing = section.fields.filter((f) => f.required && !form[f.key]?.trim());
    if (missing.length > 0) {
      setError(`Fill in: ${missing.map((f) => f.label).join(', ')}.`);
      return;
    }

    const payload: Record<string, any> = {};
    for (const field of section.fields) {
      const raw = form[field.key] ?? '';
      if (field.kind === 'number') {
        if (raw.trim() === '') {
          payload[field.key] = null;
        } else {
          const n = Number(raw);
          if (Number.isNaN(n)) {
            setError(`${field.label} must be a number.`);
            return;
          }
          payload[field.key] = n;
        }
      } else if (field.kind === 'richtext') {
        // Already sanitized on every edit inside the editor itself
        // (FyreRichTextEditor's onUpdate) and again in startEdit() on
        // load -- this third pass, right before the write to Supabase, is
        // what actually guarantees the stored `content` value can never
        // be unsanitized HTML, independent of whether either of those
        // earlier passes ran (a field that was never touched keeps
        // whatever startEdit already produced; a brand-new article goes
        // through this for the first time here).
        const cleanHtml = sanitizeArticleHtml(raw.trim());
        // TipTap's empty state is literally "<p></p>", not "" -- treat it
        // the same as a genuinely empty field (this content is optional),
        // matching how an empty plain textarea always used to save as ''.
        payload[field.key] = cleanHtml === '<p></p>' ? '' : cleanHtml;
      } else {
        payload[field.key] = raw.trim();
      }
    }
    if (section.hasImage !== false) {
      payload.image_url = imageUrl || null;
    }
    if (section.autoDate) {
      payload.date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    const result = editingId
      ? await supabase.from(section.table).update(payload).eq('id', editingId)
      : await supabase.from(section.table).insert(payload);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    resetForm();
    loadItems();
  }

  async function handleDelete(id: string) {
    await supabase.from(section.table).delete().eq('id', id);
    loadItems();
  }

  return (
    <Card className="p-6">
      <p className="text-textFaint text-xs mb-6">
        Manages the <code>{section.table}</code> table in <code>supabase/schema.sql</code>.
      </p>

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3 mb-8">
        {section.fields.map((field) => {
          if (field.kind === 'reference') {
            const opts = refOptions[field.key] ?? [];
            return (
              <select
                key={field.key}
                value={form[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                className="bg-bg rounded-lg px-4 py-3 text-sm"
              >
                <option value="">{field.required ? `Select ${field.label.toLowerCase()} *` : `Select ${field.label.toLowerCase()}`}</option>
                {opts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          }
          if (field.kind === 'select') {
            return (
              <div key={field.key} className="flex gap-3 flex-wrap">
                <select
                  value={form[field.key]}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className="bg-bg rounded-lg px-4 py-3 text-sm flex-1 min-w-[130px]"
                >
                  {field.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }
          if (field.kind === 'richtext') {
            const isPreviewing = previewFields.has(field.key);
            return (
              <div key={field.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="mdtype-overline text-textFaint">{field.label}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewFields((prev) => {
                        const next = new Set(prev);
                        if (next.has(field.key)) next.delete(field.key);
                        else next.add(field.key);
                        return next;
                      })
                    }
                    className="text-xs font-semibold text-goldBright hover:text-gold transition"
                  >
                    {isPreviewing ? 'Back to editing' : 'Preview'}
                  </button>
                </div>
                {isPreviewing ? (
                  <div className="bg-bg border border-border rounded-xl px-4 py-3.5 text-[16px] leading-[1.85] max-w-[66ch] text-text">
                    {form[field.key]?.trim() ? (
                      <ArticleBody content={form[field.key]} />
                    ) : (
                      <p className="text-textFaint text-sm">Nothing written yet.</p>
                    )}
                  </div>
                ) : (
                  <FyreRichTextEditor
                    value={form[field.key] ?? ''}
                    onChange={(html) => setField(field.key, html)}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            );
          }
          if (field.kind === 'textarea') {
            return (
              <div key={field.key} className="flex flex-col gap-1.5">
                <textarea
                  ref={(el) => {
                    textareaRefs.current[field.key] = el;
                  }}
                  value={form[field.key]}
                  onChange={(e) => setField(field.key, e.target.value)}
                  placeholder={field.required ? `${field.placeholder} *` : field.placeholder}
                  rows={field.rows}
                  className="bg-bg rounded-lg px-4 py-3 text-sm"
                />
                {field.allowTableInsert && (
                  <button
                    type="button"
                    onClick={() => setTableBuilderFor(field.key)}
                    className="text-xs font-semibold text-goldBright hover:text-gold transition self-start"
                  >
                    + Insert table
                  </button>
                )}
              </div>
            );
          }
          if (field.kind === 'number') {
            return (
              <input
                key={field.key}
                type="number"
                step={field.step ?? 'any'}
                value={form[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.required ? `${field.placeholder} *` : field.placeholder}
                className="bg-bg rounded-lg px-4 py-3 text-sm"
              />
            );
          }
          if (field.kind === 'date') {
            return (
              <input
                key={field.key}
                type="date"
                value={form[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                className="bg-bg rounded-lg px-4 py-3 text-sm"
              />
            );
          }
          return (
            <input
              key={field.key}
              type="text"
              value={form[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              placeholder={field.required ? `${field.placeholder} *` : field.placeholder}
              className="bg-bg rounded-lg px-4 py-3 text-sm"
            />
          );
        })}

        {section.hasImage !== false && (
          <>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              className="text-xs text-textFaint"
            />
            {uploading && <p className="text-xs text-textFaint">Uploading…</p>}
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-16 rounded-lg object-cover object-top" />
            )}
          </>
        )}
        <div className="flex justify-between items-center">
          {error && <span className="text-red text-xs">{error}</span>}
          <button type="submit" className="bg-gold text-white font-semibold rounded-lg px-6 py-2.5 text-sm ml-auto">
            {editingId ? `Update ${section.label.toLowerCase()}` : `Add ${section.label.toLowerCase()}`}
          </button>
        </div>
        {editingId && (
          <button type="button" onClick={resetForm} className="text-xs text-textFaint self-start">
            Cancel edit
          </button>
        )}
      </form>

      <div className="flex flex-col gap-3">
        {items.length === 0 && <p className="text-textFaint text-sm">Nothing here yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="bg-bg rounded-xl p-4 flex justify-between items-start gap-4">
            <div>
              <div className="font-medium">{section.primary(item)}</div>
              <div className="text-xs text-textFaint mt-1">{section.secondary(item)}</div>
              {section.key === 'now_showing' && item.source_synced_at && (
                <div className="text-[11px] text-goldDim mt-1">
                  Last synced {new Date(item.source_synced_at).toLocaleString()}
                </div>
              )}
            </div>
            <div className="flex gap-3 text-xs flex-none items-start">
              <button onClick={() => startEdit(item)} className="text-goldBright">
                Edit
              </button>
              <button onClick={() => handleDelete(item.id)} className="text-red">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {tableBuilderFor && (
        <TableBuilder
          onInsert={(markdown) => {
            insertAtCursor(tableBuilderFor, markdown);
            setTableBuilderFor(null);
          }}
          onClose={() => setTableBuilderFor(null)}
        />
      )}
    </Card>
  );
}
