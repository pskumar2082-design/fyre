// Pure request helpers for Fyre Analytics comparisons (safe to import in
// client components): query string <-> CompareRequest, context line.
import type { Dimension, MetricKey, Selection, Territory } from './types';

const DIMENSION_KEYS: Dimension[] = ['state', 'city', 'language', 'language_state', 'language_city', 'format', 'chain', 'venue', 'time_slot', 'show_hour', 'price_band', 'pic', 'pic_state', 'pic_city', 'theater', 'format_language'];

export type CompareRequest = {
  slugs: string[];
  selection: Selection;
  dimension?: Dimension | null;
  metric?: MetricKey;
  limit?: number | 'all';
  trend?: boolean;
  territory?: Territory; // default IN
};

export function parseTerritory(v: string | null | undefined): Territory {
  return String(v ?? '').toLowerCase() === 'us' ? 'US' : 'IN';
}

export function contextLine(sel: Selection, territory: Territory = 'IN'): string {
  const what =
    sel.basis === 'lifetime'
      ? 'LIFETIME'
      : sel.basis === 'cumulative'
        ? `FIRST ${sel.day} DAY${sel.day === 1 ? '' : 'S'}`
        : sel.basis === 'advance'
          ? `ADVANCE · DAY ${sel.day}`
          : sel.day === 0
            ? 'DAY 0 (PRE-RELEASE)'
            : `DAY ${sel.day}`;
  return territory === 'US' ? `${what} · USA · INDIAN-LANGUAGE SCREENINGS` : `${what} · INDIA · ALL LANGUAGES`;
}

export function parseSelection(q: URLSearchParams): Selection | { error: string } {
  const basis = (q.get('basis') ?? 'day') as Selection['basis'];
  const day = Math.max(0, Math.floor(Number(q.get('day') ?? 1)) || 0);
  if (basis === 'lifetime') return { basis };
  if (basis === 'cumulative') return { basis, day: Math.max(1, day) };
  if (basis === 'advance' || basis === 'day') return { basis, day };
  return { error: `Unknown basis "${basis}"` };
}

// Query-string <-> request, shared by the API route, the page and the poster route.
export function parseCompareParams(q: URLSearchParams): CompareRequest | { error: string } {
  const slugs = (q.get('movies') ?? [q.get('a'), q.get('b'), q.get('c'), q.get('d')].filter(Boolean).join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (slugs.length < 2) return { error: 'Pass at least two movies (?movies=slug-a,slug-b).' };
  const selection = parseSelection(q);
  if ('error' in selection) return selection;
  const dim = q.get('dimension');
  const dimension = dim && (DIMENSION_KEYS as string[]).includes(dim) ? (dim as Dimension) : null;
  const metric = (q.get('metric') ?? 'gross') as MetricKey;
  const limitRaw = q.get('limit');
  const limit = !limitRaw || limitRaw === 'all' ? 'all' : Math.max(1, Math.floor(Number(limitRaw)) || 10);
  return { slugs, selection, dimension, metric, limit, trend: q.get('trend') !== '0', territory: parseTerritory(q.get('territory')) };
}

export function compareQuery(req: CompareRequest): string {
  const p = new URLSearchParams();
  p.set('movies', req.slugs.join(','));
  p.set('basis', req.selection.basis);
  if (req.selection.basis !== 'lifetime') p.set('day', String(req.selection.day));
  if (req.dimension) p.set('dimension', req.dimension);
  if (req.metric) p.set('metric', req.metric);
  if (req.limit && req.limit !== 'all') p.set('limit', String(req.limit));
  if (req.trend === false) p.set('trend', '0');
  if (req.territory === 'US') p.set('territory', 'us');
  return p.toString();
}
