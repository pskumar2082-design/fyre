import { NextRequest, NextResponse } from 'next/server';
import { v2Admin } from '@/lib/v2/adminGuard';
import { getNewsroomStore } from '@/lib/newsroom/store';
import { saveDraft, ValidationError } from '@/lib/newsroom/admin';
import { effectiveStatus } from '@/lib/newsroom/visibility';
import { revalidateNewsroom } from '@/lib/newsroom/revalidate';

export const dynamic = 'force-dynamic';

// GET: the admin article list. POST: create or update a draft.
export async function GET(req: NextRequest) {
  if (!(await v2Admin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const store = await getNewsroomStore();
  const status = sp.get('status');
  const { items, total } = await store.listArticles({
    section: sp.get('section') === 'politics' ? 'politics' : sp.get('section') === 'news' ? 'news' : undefined,
    statuses: status && ['draft', 'scheduled', 'published', 'unpublished'].includes(status) ? [status as any] : undefined,
    search: sp.get('q') ?? undefined,
    limit: 100
  });
  const now = new Date();
  return NextResponse.json({ items: items.map((a) => ({ ...a, bodyHtml: undefined, effectiveStatus: effectiveStatus(a, now) })), total, store: store.kind });
}

export async function POST(req: NextRequest) {
  const editor = await v2Admin(req);
  if (!editor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    const store = await getNewsroomStore();
    const article = await saveDraft(store, body?.article, editor);
    revalidateNewsroom(article);
    return NextResponse.json({ article });
  } catch (err: any) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message, issues: err.issues }, { status: 422 });
    return NextResponse.json({ error: err?.message ?? 'Save failed' }, { status: 500 });
  }
}
