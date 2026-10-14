// MovieMint movie -> canonical Fyre movie. Pure (no I/O), unit-tested.
//
// Under the MovieMint India policy MovieMint decides WHICH movies exist on
// Fyre. Each MovieMint movie is attached to the Fyre movie that already
// represents it (keeping its Fyre id and public URL), or a new Fyre movie
// is created for it. Anything uncertain goes to admin review instead of
// being guessed. A BFILMY-only Fyre movie (no MovieMint counterpart) is
// simply never linked, so it is not public under the policy -- its rows and
// history stay untouched.

export type MmEntry = {
  id: string; // MovieMint boxOfficeId
  title: string;
  language: string | null;
  releaseDate: string | null; // YYYY-MM-DD
  badge: string | null;
};

export type FyreEntry = {
  movieId: string; // fyre_tracked_movie.moviemint_id (canonical Fyre id)
  slug: string | null; // fyre_tracked_movie.bf_slug (public slug)
  title: string | null;
  origin: string;
  releaseDate: string | null;
  firstSourceDate: string | null;
  languages: string[];
  titles?: string[]; // confirmed alternate titles (fyre_movie_alias)
};

export type LinkRow = {
  moviemint_id: string;
  movie_id: string | null;
  slug: string | null;
  link_status: 'linked' | 'needs_review' | 'excluded';
  link_method: string | null;
  link_note?: string | null;
};

export type LinkDecision = {
  moviemintId: string;
  action: 'keep' | 'link' | 'create' | 'review';
  movieId: string | null;
  slug: string | null;
  method: 'same_id' | 'title_date' | 'created' | 'admin' | 'kept' | null;
  note: string | null;
  candidates: { movieId: string; slug: string | null; title: string | null; dateGap: number | null; languageOk: boolean | null }[];
};

const DATE_WINDOW = 3;

function gap(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000));
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// First free slug: the MovieMint id itself, then -<year>, then -2, -3 ...
export function allocateSlug(mm: MmEntry, taken: Set<string>): string {
  const base = slugify(mm.id) || slugify(mm.title) || 'movie';
  const year = mm.releaseDate?.slice(0, 4);
  const tries = [base, ...(year && !base.endsWith(year) ? [`${base}-${year}`] : [])];
  for (const t of tries) if (!taken.has(t)) return t;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export function planLinks(
  mmList: MmEntry[],
  fyre: FyreEntry[],
  existing: LinkRow[],
  takenSlugs: Set<string>,
  keyOf: (title: string) => string
): LinkDecision[] {
  const byId = new Map(fyre.map((f) => [f.movieId, f]));
  const mmIds = new Set(mmList.map((m) => m.id));
  const existingBy = new Map(existing.map((e) => [e.moviemint_id, e]));
  // Fyre movies already claimed by a MovieMint movie (kept links first).
  const claimed = new Map<string, string>();
  const taken = new Set(takenSlugs);
  for (const e of existing) {
    if (e.link_status === 'linked' && e.movie_id) claimed.set(e.movie_id, e.moviemint_id);
    if (e.slug) taken.add(e.slug);
  }
  // A Fyre movie whose own id is a MovieMint id belongs to that MovieMint
  // movie, never to another one.
  for (const f of fyre) if (mmIds.has(f.movieId) && !claimed.has(f.movieId)) claimed.set(f.movieId, f.movieId);

  const out: LinkDecision[] = [];
  for (const mm of mmList) {
    const e = existingBy.get(mm.id);
    if (e && (e.link_status === 'excluded' || e.link_method === 'admin' || (e.link_status === 'linked' && e.movie_id && byId.has(e.movie_id)))) {
      out.push({ moviemintId: mm.id, action: 'keep', movieId: e.movie_id, slug: e.slug, method: 'kept', note: null, candidates: [] });
      continue;
    }

    const same = byId.get(mm.id);
    if (same) {
      const slugFree = same.slug && (!taken.has(same.slug) || e?.slug === same.slug || isOwnSlug(same, existing, mm.id));
      const slug = slugFree ? same.slug! : allocateSlug(mm, taken);
      taken.add(slug);
      claimed.set(same.movieId, mm.id);
      out.push({ moviemintId: mm.id, action: 'link', movieId: same.movieId, slug, method: 'same_id', note: null, candidates: [] });
      continue;
    }

    const key = keyOf(mm.title);
    const titleHits = fyre.filter(
      (f) => !mmIds.has(f.movieId) && (claimed.get(f.movieId) ?? mm.id) === mm.id && [f.title, ...(f.titles ?? [])].some((t) => t && keyOf(t) === key)
    );
    const cands = titleHits.map((f) => {
      const dateGap = [gap(mm.releaseDate, f.releaseDate), gap(mm.releaseDate, f.firstSourceDate)].filter((g): g is number => g != null).sort((a, b) => a - b)[0] ?? null;
      const languageOk = mm.language && f.languages.length ? f.languages.includes(mm.language) : null;
      return { movieId: f.movieId, slug: f.slug, title: f.title, dateGap, languageOk };
    });
    const fits = cands.filter((c) => c.dateGap != null && c.dateGap <= DATE_WINDOW && c.languageOk !== false);

    if (fits.length === 1 && cands.length === 1) {
      const f = byId.get(fits[0].movieId)!;
      const slug = f.slug && !taken.has(f.slug) ? f.slug : f.slug && isOwnSlug(f, existing, mm.id) ? f.slug : allocateSlug(mm, taken);
      taken.add(slug);
      claimed.set(f.movieId, mm.id);
      out.push({ moviemintId: mm.id, action: 'link', movieId: f.movieId, slug, method: 'title_date', note: null, candidates: cands });
      continue;
    }
    if (cands.length) {
      const why =
        fits.length > 1 || (fits.length === 1 && cands.length > 1)
          ? `${cands.length} Fyre movies share this title`
          : cands.some((c) => c.languageOk === false)
            ? `language ${mm.language} not among the Fyre movie's languages`
            : mm.releaseDate
              ? `release dates more than ${DATE_WINDOW} days apart`
              : 'MovieMint gives no release date';
      out.push({ moviemintId: mm.id, action: 'review', movieId: null, slug: null, method: null, note: why, candidates: cands });
      continue;
    }

    const slug = allocateSlug(mm, taken);
    taken.add(slug);
    out.push({ moviemintId: mm.id, action: 'create', movieId: mm.id, slug, method: 'created', note: null, candidates: [] });
  }
  return out;
}

// The Fyre movie's own current slug (its existing public URL) counts as
// free for the MovieMint movie that takes that Fyre movie over.
function isOwnSlug(f: FyreEntry, existing: LinkRow[], mmId: string): boolean {
  const holder = existing.find((e) => e.slug === f.slug && e.link_status === 'linked');
  return !holder || holder.moviemint_id === mmId;
}
