import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v2Admin } from '@/lib/v2/adminGuard';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { newId } from '@/lib/newsroom/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const MAX_BYTES = 2 * 1024 * 1024; // the editor resizes to ~500 KB before upload

// Article image upload. Supabase store: the existing public `images` bucket
// under cms/<year>/<month>/. Local file store: public/dev-uploads/ (ignored
// by git).
export async function POST(req: NextRequest) {
  if (!(await v2Admin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // Preview sandbox: no storage writes at all.
  if (process.env.NEWSROOM_STORE === 'memory') {
    return NextResponse.json({ error: 'Image uploads are switched off on the Preview, so nothing is written to storage. They work once the newsroom uses Supabase.' }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof Blob)) return NextResponse.json({ error: 'No file' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Use a JPEG, PNG, WebP or AVIF image.' }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image is larger than 2 MB after resizing.' }, { status: 413 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const d = new Date();
  const rel = `cms/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${newId()}.${ext}`;

  if ((process.env.NEWSROOM_STORE ?? 'supabase') === 'file') {
    if (process.env.VERCEL) return NextResponse.json({ error: 'Local uploads are not available on Vercel' }, { status: 500 });
    const target = path.join(process.cwd(), 'public', 'dev-uploads', rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    return NextResponse.json({ url: `/dev-uploads/${rel}` });
  }
  const { error } = await supabaseAdmin.storage.from('images').upload(rel, bytes, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  const { data } = supabaseAdmin.storage.from('images').getPublicUrl(rel);
  return NextResponse.json({ url: data.publicUrl });
}
