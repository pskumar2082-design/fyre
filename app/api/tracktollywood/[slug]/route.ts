import { NextRequest, NextResponse } from 'next/server';
import { getMovieDetails } from '@/lib/bfilmy/source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const details = await getMovieDetails(params.slug);
    if (!details) {
      return NextResponse.json({ error: `No movie found at slug "${params.slug}"` }, { status: 404 });
    }
    return NextResponse.json(details);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load this movie right now' }, { status: 502 });
  }
}
