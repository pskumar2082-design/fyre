import { NextRequest, NextResponse } from 'next/server';
import { newsroomEnabled } from '@/lib/v2/flags';
import { getNewsroomStore } from '@/lib/newsroom/store';
import { isPublic } from '@/lib/newsroom/visibility';

export const dynamic = 'force-dynamic';

// Anonymous view counter for Trending Stories. Only counts public articles.
export async function POST(req: NextRequest) {
  if (!newsroomEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id.slice(0, 64) : '';
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    const store = await getNewsroomStore();
    const a = await store.getArticle(id);
    if (!a || !isPublic(a, new Date())) return NextResponse.json({ ok: false }, { status: 404 });
    await store.recordView(id, new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
