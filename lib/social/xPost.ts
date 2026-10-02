// X post -> Fyre social card: everything that is pure (no network). Shared
// by the admin API routes and the admin editor (client).
//
// Imported X content is INPUT, never final poster copy: the admin edits
// every field, and nothing here invents a fact -- rewrites only reorder and
// trim the post's own words; numbers come from the post or, explicitly
// chosen, from Fyre's own analytics, never mixed silently.

export type XPostRef = { id: string; handle: string | null; url: string };

const X_HOSTS = new Set(['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com']);
const STATUS_PATH = /^\/(?:([A-Za-z0-9_]{1,15})|i\/web|i)\/status(?:es)?\/(\d{1,25})(?:\/(?:photo|video)\/\d)?\/?$/;

// Only an individual post: x.com/<handle>/status/<id> (or twitter.com, or
// x.com/i/web/status/<id>). Anything else is refused.
export function parseXPostUrl(input: string): XPostRef | { error: string } {
  let raw = String(input ?? '').trim();
  if (!raw) return { error: 'Paste an X post URL' };
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { error: 'Not a valid URL' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'Not a valid URL' };
  if (u.username || u.password || (u.port && u.port !== '443' && u.port !== '80')) return { error: 'Not an X post URL' };
  if (!X_HOSTS.has(u.hostname.toLowerCase())) return { error: 'Only x.com / twitter.com post URLs are accepted' };
  const m = u.pathname.match(STATUS_PATH);
  if (!m) return { error: 'Not an individual post — the URL must look like x.com/<account>/status/<number>' };
  const handle = m[1] && m[1].toLowerCase() !== 'i' ? m[1] : null;
  return { id: m[2], handle, url: `https://x.com/${handle ?? 'i/web'}/status/${m[2]}` };
}

// The token X's own embed widget sends with a post id.
export function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

export type ImportedMedia = { type: 'photo' | 'video' | 'animated_gif'; url: string; width: number; height: number; alt: string | null };

export type ImportedPost = {
  id: string;
  url: string;
  authorName: string;
  handle: string;
  text: string;
  postedAt: string | null;
  hashtags: string[];
  mentions: { handle: string; name: string | null }[];
  links: string[];
  media: ImportedMedia[];
  lang: string | null;
  via: 'syndication' | 'oembed';
  truncated: boolean; // a long post whose full text the embed data did not include
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

const MEDIA_PATH = /^\/(media|ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)\/[A-Za-z0-9_\-/.]+$/;

// The only image host a card may load from (X's media CDN, image paths).
export function isAllowedMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'pbs.twimg.com' && !u.port && !u.username && MEDIA_PATH.test(u.pathname);
  } catch {
    return false;
  }
}

// pbs.twimg.com/media/ID.jpg -> a sized variant (small / large / orig).
export function mediaVariant(url: string, name: 'small' | 'medium' | 'large' | 'orig'): string {
  const u = new URL(url);
  const m = u.pathname.match(/^\/media\/([^.]+)\.(jpg|jpeg|png|webp)$/);
  if (m) return `https://pbs.twimg.com/media/${m[1]}?format=${m[2] === 'png' ? 'png' : 'jpg'}&name=${name}`;
  return url;
}

// X's embed JSON (cdn.syndication.twimg.com/tweet-result) -> ImportedPost.
export function normalizeSyndication(j: any, ref: XPostRef): ImportedPost | null {
  if (!j || typeof j !== 'object' || typeof j.text !== 'string' || !j.user) return null;
  const ent = j.entities ?? {};
  let text = decodeEntities(String(j.text));
  for (const m of ent.media ?? []) if (m?.url) text = text.split(m.url).join('');
  const links: string[] = [];
  for (const u of ent.urls ?? []) {
    if (!u?.url) continue;
    const expanded = u.expanded_url ?? u.url;
    links.push(expanded);
    text = text.split(u.url).join(expanded);
  }
  const media: ImportedMedia[] = [];
  for (const m of j.mediaDetails ?? []) {
    const url = m?.media_url_https;
    if (!url || !isAllowedMediaUrl(url)) continue;
    const type = m.type === 'video' || m.type === 'animated_gif' ? m.type : 'photo';
    media.push({ type, url, width: Number(m.original_info?.width) || 0, height: Number(m.original_info?.height) || 0, alt: m.ext_alt_text ?? null });
  }
  return {
    id: String(j.id_str ?? ref.id),
    url: `https://x.com/${j.user.screen_name ?? ref.handle ?? 'i/web'}/status/${j.id_str ?? ref.id}`,
    authorName: String(j.user.name ?? ''),
    handle: String(j.user.screen_name ?? ref.handle ?? ''),
    text: text.trim(),
    postedAt: j.created_at ? new Date(j.created_at).toISOString() : null,
    hashtags: [...new Set((ent.hashtags ?? []).map((h: any) => String(h.text)))] as string[],
    mentions: (ent.user_mentions ?? []).map((m: any) => ({ handle: String(m.screen_name), name: m.name ? String(m.name) : null })),
    links: [...new Set(links)],
    media,
    lang: j.lang ?? null,
    via: 'syndication',
    truncated: !!j.note_tweet
  };
}

// X's oEmbed (publish.x.com/oembed) -> ImportedPost. Text and author only:
// oEmbed carries no media.
export function parseOembed(j: any, ref: XPostRef): ImportedPost | null {
  const html = typeof j?.html === 'string' ? j.html : '';
  const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
  if (!p) return null;
  const links = [...p[1].matchAll(/<a href="([^"]+)"/g)].map((m) => decodeEntities(m[1]));
  const text = decodeEntities(
    p[1]
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<a [^>]*>(pic\.(?:twitter|x)\.com\/[^<]+)<\/a>/gi, '')
      .replace(/<[^>]+>/g, '')
  ).trim();
  const dateText = [...html.matchAll(/<a [^>]*>([^<]+)<\/a>\s*<\/blockquote>/g)].map((m) => m[1]).pop();
  const posted = dateText ? Date.parse(dateText) : NaN;
  const handle = String(j.author_url ?? '').split('/').filter(Boolean).pop() ?? ref.handle ?? '';
  return {
    id: ref.id,
    url: `https://x.com/${handle || 'i/web'}/status/${ref.id}`,
    authorName: decodeEntities(String(j.author_name ?? '')),
    handle,
    text,
    postedAt: Number.isFinite(posted) ? new Date(posted).toISOString() : null,
    hashtags: [...new Set([...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]))],
    mentions: [...text.matchAll(/@([A-Za-z0-9_]{1,15})/g)].map((m) => ({ handle: m[1], name: null })),
    links: [...new Set(links.filter((l) => !/\/status\/\d+/.test(l) && !/^https?:\/\/(x|twitter)\.com\/hashtag\//.test(l)))],
    media: [],
    lang: null,
    via: 'oembed',
    truncated: false
  };
}

// ---------------------------------------------------------------------------
// Reading the post
// ---------------------------------------------------------------------------

// "#VijaySethupathi" -> "Vijay Sethupathi", "#RanabaaliOnOct16th" -> "Ranabaali On Oct 16th".
export function splitHashtag(tag: string): string {
  return tag
    .replace(/^#/, '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

const key = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}‍︎️⃣]/gu;

// The post's own words, made readable on a poster: no links, no emoji, no
// trailing hashtag block; inline #Tags become words and @handles become the
// account's display name where X provided it.
export function cleanPostText(post: Pick<ImportedPost, 'text' | 'mentions'>): string {
  const names = new Map(post.mentions.map((m) => [m.handle.toLowerCase(), m.name]));
  const lines = post.text
    .replace(/https?:\/\/\S+/g, '')
    .replace(EMOJI, '')
    .split('\n')
    .map((l) => l.trim());
  // A line made only of hashtags/mentions is a tag block, not content.
  const kept = lines.filter((l) => !/^([#@][\p{L}\p{N}_]+[\s,|/·•-]*)+$/u.test(l));
  return kept
    .join('\n')
    .replace(/#(\p{L}[\p{L}\p{N}_]*)/gu, (_, t) => splitHashtag(t))
    .replace(/@([A-Za-z0-9_]{1,15})/g, (_, h) => names.get(h.toLowerCase()) ?? h)
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([,.!?:;])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type ReportedNumber = { raw: string; value: number; currency: 'INR' | 'USD'; decimals: number; unit: 'cr' | 'l' | 'm' | 'k' | 'b' | ''; index: number };

const INR = /(?:₹|\bRs\.?\s?|\bINR\s?)\s?(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s?(crores?|cr|lakhs?|lacs?|l|k)?\b\+?|\b(\d+(?:\.\d+)?)\s?(crores?|cr)\b\+?/gi;
const USD = /\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(million|m|k|b|billion)?\b\+?/gi;

// Collection figures written in the post ("₹1.54Cr", "250 CRORES+", "$1.2M").
export function extractNumbers(text: string): ReportedNumber[] {
  const out: ReportedNumber[] = [];
  for (const m of text.matchAll(INR)) {
    const digits = (m[1] ?? m[3]).replace(/,/g, '');
    const unitRaw = (m[2] ?? m[4] ?? '').toLowerCase();
    const unit: ReportedNumber['unit'] = unitRaw.startsWith('cr') ? 'cr' : unitRaw.startsWith('l') ? 'l' : unitRaw === 'k' ? 'k' : '';
    const n = Number(digits);
    if (!Number.isFinite(n)) continue;
    const value = unit === 'cr' ? n * 1e7 : unit === 'l' ? n * 1e5 : unit === 'k' ? n * 1e3 : n;
    out.push({ raw: m[0].trim(), value, currency: 'INR', decimals: (digits.split('.')[1] ?? '').length, unit, index: m.index ?? 0 });
  }
  for (const m of text.matchAll(USD)) {
    const digits = m[1].replace(/,/g, '');
    const u = (m[2] ?? '').toLowerCase();
    const unit: ReportedNumber['unit'] = u.startsWith('m') ? 'm' : u.startsWith('b') ? 'b' : u === 'k' ? 'k' : '';
    const n = Number(digits);
    const value = unit === 'm' ? n * 1e6 : unit === 'b' ? n * 1e9 : unit === 'k' ? n * 1e3 : n;
    out.push({ raw: m[0].trim(), value, currency: 'USD', decimals: (digits.split('.')[1] ?? '').length, unit, index: m.index ?? 0 });
  }
  return out.sort((a, b) => a.index - b.index);
}

// Which day / span a post's figure is about, when it says so.
export function reportedSelection(text: string): { kind: 'day'; day: number } | { kind: 'cumulative'; days: number | null } | null {
  const t = text.toLowerCase();
  if (/\bopening day\b|\bday\s?1\b|\bday one\b/.test(t)) return { kind: 'day', day: 1 };
  const d = t.match(/\bday\s?(\d{1,3})\b/);
  if (d && !/\bdays?\s?\d+\s*(?:total|cume|cumulative)/.test(t)) return { kind: 'day', day: Number(d[1]) };
  const n = t.match(/\b(?:in|after|first)\s+(\d{1,3})\s+days\b/);
  if (n) return { kind: 'cumulative', days: Number(n[1]) };
  if (/\b(worldwide|total|so far|till date|lifetime|cume|cumulative)\b/.test(t)) return { kind: 'cumulative', days: null };
  return null;
}

// Fyre's figure written the way the post wrote its own (same unit and
// decimals), so "₹1.54Cr" matches a tracked ₹1,53,78,000 but "₹123 Cr" does
// not match ₹103.19 Cr.
export function sameAsReported(reported: ReportedNumber, fyreValue: number, fyreCurrency: 'INR' | 'USD'): boolean {
  if (reported.currency !== fyreCurrency) return false;
  const div = { cr: 1e7, l: 1e5, m: 1e6, k: 1e3, b: 1e9, '': 1 }[reported.unit];
  const a = (reported.value / div).toFixed(reported.decimals);
  const b = (fyreValue / div).toFixed(reported.decimals);
  return a === b;
}

export const CONTENT_TYPES = [
  'announcement',
  'breaking',
  'boxoffice',
  'movieUpdate',
  'releaseDate',
  'firstLook',
  'posterReveal',
  'casting',
  'review',
  'achievement',
  'general'
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_LABEL: Record<ContentType, string> = {
  announcement: 'Announcement',
  breaking: 'Breaking News',
  boxoffice: 'Box Office',
  movieUpdate: 'Movie Update',
  releaseDate: 'Release Date',
  firstLook: 'First Look',
  posterReveal: 'Poster Reveal',
  casting: 'Casting',
  review: 'Review / Reaction',
  achievement: 'Achievement / Record',
  general: 'General'
};

// The small category line printed on the card.
export const CATEGORY: Record<ContentType, string> = {
  announcement: 'ANNOUNCEMENT',
  breaking: 'BREAKING NEWS',
  boxoffice: 'BOX OFFICE',
  movieUpdate: 'MOVIE UPDATE',
  releaseDate: 'RELEASE DATE',
  firstLook: 'FIRST LOOK',
  posterReveal: 'POSTER REVEAL',
  casting: 'CASTING',
  review: 'REVIEW',
  achievement: 'NEW MILESTONE',
  general: 'MOVIE UPDATE'
};

export function classifyPost(text: string, mediaCount: number): ContentType {
  const t = text.toLowerCase();
  const numbers = extractNumbers(text);
  if (/first[\s-]?look|#firstlook|\bfl\b/.test(t)) return 'firstLook';
  if (/\b(character|title|motion|release|new|official)?\s?poster\b|title (?:reveal|announcement)/.test(t) && mediaCount > 0) return 'posterReveal';
  if (/(crosse[sd]|milestone|\brecords?\b|record[- ]breaking|historic|highest|biggest|crore club|cr club|\btrending\s?#?1\b|#1\b|all[- ]time)/.test(t)) return 'achievement';
  if (numbers.length && /(gross|collection|box ?office|\bbo\b|opening|day\s?\d|advance|share|\bnett?\b|worldwide)/.test(t)) return 'boxoffice';
  if (/\b(review|rating|stars?|verdict|reaction|public talk)\b|\d(?:\.\d+)?\s?\/\s?5\b/.test(t)) return 'review';
  if (/(release|releasing|in (?:cinemas|theatres|theaters)|grand release|worldwide on|hitting (?:the )?screens)/.test(t)) return 'releaseDate';
  if (/\b(joins|joined|on board|onboard|roped in|welcom(?:e|es|ing)|cast as|plays? the role|starring)\b/.test(t)) return 'casting';
  if (/^\s*(?:#?breaking|big news)\b/.test(t)) return 'breaking';
  if (/\b(announc\w*|officially|launch(?:ed)?|pooja|shoot|wrap(?:ped)? up)\b/.test(t)) return 'announcement';
  if (/\b(trailer|teaser|song|glimpse|update|ott|streaming|out now)\b/.test(t)) return 'movieUpdate';
  return 'general';
}

export type TemplateId = 'news' | 'imageFirst' | 'boxoffice' | 'achievement' | 'quote';

export const TEMPLATE_LABEL: Record<TemplateId, string> = {
  news: 'A · News / Announcement',
  imageFirst: 'B · Image-first / First look',
  boxoffice: 'C · Box office',
  achievement: 'D · Achievement / Record',
  quote: 'E · Quote / Update'
};

export function templateFor(type: ContentType, mediaCount: number, textLength: number): TemplateId {
  if (type === 'boxoffice') return 'boxoffice';
  if (type === 'achievement') return 'achievement';
  if ((type === 'firstLook' || type === 'posterReveal') && mediaCount > 0) return 'imageFirst';
  if (type === 'review') return 'quote';
  if (mediaCount === 0 && textLength > 160) return 'quote';
  return 'news';
}

export type CatalogTitle = { slug: string; title: string };

// The Fyre movie the post is about: a hashtag that is (or starts with) a
// Fyre title, else the title written in the text.
export function detectMovie(post: Pick<ImportedPost, 'text' | 'hashtags'>, catalog: CatalogTitle[]): { slug: string; title: string; reason: string } | null {
  const tags = post.hashtags.map(key);
  const text = key(post.text);
  const cands = catalog.map((c) => ({ ...c, k: key(c.title) })).filter((c) => c.k.length >= 3);
  const byTag = cands.filter((c) => tags.some((t) => t === c.k)).sort((a, b) => b.k.length - a.k.length)[0];
  if (byTag) return { slug: byTag.slug, title: byTag.title, reason: 'hashtag' };
  const prefixTag = cands.filter((c) => c.k.length >= 5 && tags.some((t) => t.startsWith(c.k))).sort((a, b) => b.k.length - a.k.length)[0];
  if (prefixTag) return { slug: prefixTag.slug, title: prefixTag.title, reason: 'hashtag' };
  const inText = cands.filter((c) => c.k.length >= 6 && text.includes(c.k)).sort((a, b) => b.k.length - a.k.length)[0];
  return inText ? { slug: inText.slug, title: inText.title, reason: 'title in text' } : null;
}

// A readable movie name from the first hashtag, when no Fyre movie matched.
export function movieNameFromTags(hashtags: string[]): string | null {
  const tag = hashtags.find((h) => h.length >= 3 && !/^(boxoffice|bo|breaking|ott|netflix|trending)$/i.test(h));
  return tag ? splitHashtag(tag) : null;
}

function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9"'“‘₹$#])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  const clause = s.slice(0, max).match(/^(.*[^\s])[,;:–—-]\s/);
  if (clause && clause[1].length >= max * 0.5) return clause[1];
  return s.slice(0, max).replace(/\s+\S*$/, '');
}

function camel(s: string): string {
  return s
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
}

const TYPE_TAG: Partial<Record<ContentType, string>> = {
  boxoffice: 'BoxOffice',
  firstLook: 'FirstLook',
  posterReveal: 'FirstLook',
  releaseDate: 'ReleaseDate',
  review: 'MovieReview'
};

export type Copy = { headline: string; subhead: string; body: string; caption: string; hashtags: string };

// "Rewrite for Fyre": the post's own sentences, restructured (headline,
// subhead, body), with its hashtags tidied. No fact is added: every number
// and name in the output appears in the post (or is the chosen movie name).
export function rewriteForFyre(post: Pick<ImportedPost, 'text' | 'mentions' | 'hashtags'>, opts: { movie?: string | null; type: ContentType }): Copy {
  const clean = cleanPostText(post);
  const s = sentences(clean);
  const first = (s[0] ?? '').replace(/[.!]+$/, '');
  // The whole first sentence when it is headline-length; a long one is cut
  // at a clause and the rest leads the subhead (never dropped).
  const MAX = 130;
  const head = first.length <= MAX ? first : cut(first, MAX);
  const tail = first.slice(head.length).replace(/^[\s,;:–—-]+/, '');
  const headline = head.toUpperCase();
  const rest = tail ? [tail.charAt(0).toUpperCase() + tail.slice(1), ...s.slice(1)] : s.slice(1);
  const subhead = cut(rest[0] ?? '', 160);
  const body = cut(rest.slice(1).join(' '), 280);
  const seen = new Set<string>();
  const tags = [...(opts.movie ? [camel(opts.movie)] : []), ...post.hashtags, ...(TYPE_TAG[opts.type] ? [TYPE_TAG[opts.type]!] : []), 'IndianCinema']
    .filter((t) => t && /^\p{L}/u.test(t) && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()))
    .slice(0, 6)
    .map((t) => `#${t}`)
    .join(' ');
  const copy = { headline, subhead, body, hashtags: tags, caption: '' };
  copy.caption = buildCaption(copy);
  return copy;
}

// The social caption under the poster, from the current fields.
export function buildCaption(c: { headline: string; subhead?: string; body?: string; hashtags?: string }): string {
  const lead = c.headline.trim();
  const sentence = lead && lead === lead.toUpperCase() && /[A-Z]/.test(lead) ? titleCase(lead) : lead;
  const context = [c.subhead, c.body].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
  return [sentence ? `${sentence} 🔥` : '', context, (c.hashtags ?? '').trim()].filter(Boolean).join('\n\n');
}

const SMALL = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 'from', 'as', 'its']);
// "THE PARADISE CONTINUES ITS STRONG RUN" -> "The Paradise Continues its Strong Run"
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.replace(/^(\p{L})/u, (c) => c.toUpperCase())))
    .join(' ')
    .replace(/(\d)cr\b/gi, '$1Cr')
    .replace(/\b(ott|bo|usa|uk|us)\b/gi, (m) => m.toUpperCase());
}
