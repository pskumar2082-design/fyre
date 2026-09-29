import { NextResponse } from 'next/server';
import { getCompletedMovies } from '@/lib/bfilmy/source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const movies = await getCompletedMovies();
    return NextResponse.json({ movies, count: movies.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load the box office archive right now' }, { status: 502 });
  }
}
