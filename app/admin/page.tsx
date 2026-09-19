'use client';

import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Section config: this is "the News admin pattern" generalized so the same
// load / submit / delete / image-upload logic and the same form + list UI
// drive all six tables in supabase/schema.sql, instead of six near-identical
// copies of the Dashboard component. Add a new table here and it gets a full
// admin tab for free.
// ---------------------------------------------------------------------------

type Field =
  | { key: string; label: string; kind: 'text'; required?: boolean; placeholder: string }
  | { key: string; label: string; kind: 'textarea'; required?: boolean; placeholder: string; rows: number }
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
        kind: 'textarea',
        rows: 6,
        placeholder: 'Full article text (optional) — separate paragraphs with a blank line'
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
        kind: 'textarea',
        rows: 6,
        placeholder: 'Full review text (optional) — separate paragraphs with a blank line'
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
      {
        key: 'source_url',
        label: 'Box office source (optional)',
        kind: 'text',
        placeholder: 'Sacnilk day-wise article URL — enables the Sync now button below'
      },
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
    primary: (m) => m.title,
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

function AdminShell() {
  const [activeKey, setActiveKey] = useState(SECTIONS[0].key);
  const active = SECTIONS.find((s) => s.key === activeKey)!;

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="hdisplay gtext text-2xl">fyre admin</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-textFaint border border-border rounded-full px-3 py-1.5"
        >
          Sign out
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-6 border-b border-border pb-4">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveKey(s.key)}
            className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition ${
              s.key === activeKey
                ? 'bg-gold text-white border-gold'
                : 'text-textFaint border-border hover:border-goldDim'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* key={active.key} remounts the Dashboard on tab switch, which resets
          all its form/list state for free instead of a manual reset effect. */}
      <Dashboard key={active.key} section={active} />
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
  // for the now_showing section's "Sync now" button (see /api/admin-sync-boxoffice)
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [discovering, setDiscovering] = useState(false);

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
      const value = item[field.key];
      next[field.key] = value === null || value === undefined ? '' : String(value);
    }
    setForm(next);
    setImageUrl(item.image_url || '');
  }

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
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

  // Pulls day-wise numbers for this one movie from its `source_url` (see
  // lib/sacnilkParser.ts + supabase/migration_scraper.sql) and writes them
  // into daily_collections + this movie's lifetime_* fields. Authorized by
  // this admin session, not a shared secret — see app/api/admin-sync-boxoffice.
  async function handleSync(id: string) {
    setSyncingId(id);
    setSyncMessage('');
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/admin-sync-boxoffice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ movie_id: id })
      });
      const result = await res.json();
      if (result.error) {
        setSyncMessage(`Sync failed: ${result.error}`);
      } else if (result.errors?.length) {
        setSyncMessage(`Sync failed: ${result.errors[0].message}`);
      } else if (result.synced?.length) {
        setSyncMessage(`Synced ${result.synced[0]} — reloading…`);
      } else {
        setSyncMessage('Nothing synced — check the source URL.');
      }
      loadItems();
    } catch (err: any) {
      setSyncMessage(`Sync failed: ${err?.message ?? err}`);
    } finally {
      setSyncingId(null);
    }
  }

  // Checks Sacnilk's public box-office listing for movies we don't have
  // yet and adds them (see lib/discoverMovies.ts) — the same discovery
  // step the daily cron runs, available here so you don't have to wait
  // for the schedule. Reuses the same admin-authorized route as "Sync
  // now", just without a movie_id, which is what turns discovery on.
  async function handleDiscover() {
    setDiscovering(true);
    setSyncMessage('');
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/admin-sync-boxoffice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({})
      });
      const result = await res.json();
      if (result.error) {
        setSyncMessage(`Discovery failed: ${result.error}`);
      } else {
        const parts: string[] = [];
        if (result.discovered?.length) {
          parts.push(`${result.discovered.length} now showing (${result.discovered.join(', ')})`);
        }
        if (result.discoveredUpcoming?.length) {
          parts.push(`${result.discoveredUpcoming.length} upcoming (${result.discoveredUpcoming.join(', ')})`);
        }
        if (parts.length) {
          setSyncMessage(`Added: ${parts.join(' · ')}`);
        } else if (result.discoveryErrors?.length) {
          setSyncMessage(`Discovery failed: ${result.discoveryErrors[0].message}`);
        } else if (result.upcomingDiscoveryErrors?.length) {
          setSyncMessage(`Discovery failed: ${result.upcomingDiscoveryErrors[0].message}`);
        } else {
          setSyncMessage('No new movies found.');
        }
      }
      loadItems();
    } catch (err: any) {
      setSyncMessage(`Discovery failed: ${err?.message ?? err}`);
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <div>
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
                className="bg-bgAlt border border-border rounded-lg px-3 py-2 text-sm"
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
                  className="bg-bgAlt border border-border rounded-lg px-3 py-2 text-sm flex-1 min-w-[130px]"
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
          if (field.kind === 'textarea') {
            return (
              <textarea
                key={field.key}
                value={form[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.required ? `${field.placeholder} *` : field.placeholder}
                rows={field.rows}
                className="bg-bgAlt border border-border rounded-lg px-3 py-2 text-sm"
              />
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
                className="bg-bgAlt border border-border rounded-lg px-3 py-2 text-sm"
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
                className="bg-bgAlt border border-border rounded-lg px-3 py-2 text-sm"
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
              className="bg-bgAlt border border-border rounded-lg px-3 py-2 text-sm"
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
          <button type="submit" className="bg-gold text-white font-semibold rounded-lg px-4 py-2 text-sm ml-auto">
            {editingId ? `Update ${section.label.toLowerCase()}` : `Add ${section.label.toLowerCase()}`}
          </button>
        </div>
        {editingId && (
          <button type="button" onClick={resetForm} className="text-xs text-textFaint self-start">
            Cancel edit
          </button>
        )}
      </form>

      {(section.key === 'now_showing' || section.key === 'upcoming') && (
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={handleDiscover}
            disabled={discovering}
            className="text-xs font-semibold text-goldBright border border-gold/30 rounded-full px-3 py-1.5 hover:border-gold transition disabled:opacity-50"
          >
            {discovering ? 'Checking Sacnilk…' : 'Find new movies'}
          </button>
          {syncMessage && <p className="text-xs text-textDim">{syncMessage}</p>}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.length === 0 && <p className="text-textFaint text-sm">Nothing here yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="bg-surface border border-border rounded-lg p-4 flex justify-between items-start gap-4">
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
              {section.key === 'now_showing' && item.source_url && (
                <button
                  onClick={() => handleSync(item.id)}
                  disabled={syncingId === item.id}
                  className="text-goldBright disabled:opacity-50"
                >
                  {syncingId === item.id ? 'Syncing…' : 'Sync now'}
                </button>
              )}
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
    </div>
  );
}
