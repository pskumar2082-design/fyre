import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUser } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCompletedMovies, getLiveMovies } from '@/lib/bfilmy/source';
import { importXPost, mediaDataUri, XFetchError } from '@/lib/social/xFetch';
import { fyreFigures, type FyreSelection } from '@/lib/social/fyreData';
import {
  classifyPost,
  detectMovie,
  extractNumbers,
  movieNameFromTags,
  parseXPostUrl,
  reportedSelection,
  rewriteForFyre,
  templateFor
} from '@/lib/social/xPost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Admin → Social poster → X Post Designer.
// POST { action: 'import', url }   read one X post (only when an admin submits
//                                   its URL; only X's own hosts are contacted)
// POST { action: 'fyreData', slug, territory: 'IN'|'US', selection }
//                                   Fyre's tracked box office for a box-office card
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.action === 'fyreData') {
    const territory = body.territory === 'US' ? 'US' : 'IN';
    const sel = body.selection as FyreSelection;
    if (!body.slug || !sel?.kind) return NextResponse.json({ error: 'slug and selection required' }, { status: 400 });
    const r = await fyreFigures(String(body.slug), territory, sel);
    return NextResponse.json(r, { status: 'error' in r ? 404 : 200 });
  }

  if (body.action !== 'import') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  const ref = parseXPostUrl(String(body.url ?? ''));
  if ('error' in ref) return NextResponse.json({ error: ref.error }, { status: 400 });
  try {
    const { post, warnings } = await importXPost(ref);
    const catalog = [...(await getLiveMovies().catch(() => [])), ...(await getCompletedMovies().catch(() => []))].map((m) => ({ slug: m.slug, title: m.title }));
    const movie = detectMovie(post, catalog);
    const movieName = movie?.title ?? movieNameFromTags(post.hashtags);
    const media = post.media.slice(0, 4);
    const thumbs = await Promise.all(media.map((m) => mediaDataUri(m.url, 'small').catch(() => null)));
    const type = classifyPost(post.text, media.length);
    const template = templateFor(type, media.length, post.text.length);
    const numbers = extractNumbers(post.text);
    const selection = reportedSelection(post.text);
    const copy = rewriteForFyre(post, { movie: movieName, type });

    // Editorial trace: where this card's content came from.
    const user = await adminUser(req);
    const { data: saved, error: saveErr } = await (supabaseAdmin as any)
      .from('social_import')
      .insert({
        source_url: post.url,
        post_id: post.id,
        author_name: post.authorName,
        author_handle: post.handle,
        post_text: post.text,
        posted_at: post.postedAt,
        media: post.media,
        hashtags: post.hashtags,
        links: post.links,
        mentions: post.mentions,
        via: post.via,
        imported_by: user?.email ?? user?.id ?? null
      })
      .select('id')
      .maybeSingle();
    if (saveErr) warnings.push(`Import not logged (${saveErr.message})`);

    return NextResponse.json({ importId: saved?.id ?? null, post, thumbs, movie, movieName, type, template, numbers, selection, copy, warnings });
  } catch (err: any) {
    const msg = err instanceof XFetchError ? err.message : `Import failed: ${err?.message ?? err}`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
