import { NextRequest, NextResponse } from 'next/server';
import { v2Admin } from '@/lib/v2/adminGuard';
import { getNewsroomStore } from '@/lib/newsroom/store';
import { changeStatus, restoreRevision, ValidationError } from '@/lib/newsroom/admin';
import { publishIssues } from '@/lib/newsroom/validate';
import { revalidateNewsroom } from '@/lib/newsroom/revalidate';

export const dynamic = 'force-dynamic';

// GET: one article with its revisions and publish checklist.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!(await v2Admin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const store = await getNewsroomStore();
  const article = await store.getArticle(params.id);
  if (!article) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const [revisions, cats] = await Promise.all([store.listRevisions(params.id), store.listCategories()]);
  return NextResponse.json({ article, revisions: revisions.map((r) => ({ id: r.id, editedBy: r.editedBy, editedAt: r.editedAt, note: r.note })), publishIssues: publishIssues(article, cats) });
}

// POST { action: publish | schedule | unpublish | revert_to_draft | restore, at?, revisionId? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const editor = await v2Admin(req);
  if (!editor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const store = await getNewsroomStore();
    const article =
      body?.action === 'restore' ? await restoreRevision(store, params.id, String(body?.revisionId ?? ''), editor) : await changeStatus(store, params.id, String(body?.action ?? ''), body?.at, editor);
    revalidateNewsroom(article);
    return NextResponse.json({ article });
  } catch (err: any) {
    if (err instanceof ValidationError) return NextResponse.json({ error: err.message, issues: err.issues }, { status: 422 });
    return NextResponse.json({ error: err?.message ?? 'Failed' }, { status: 500 });
  }
}
