import { NextResponse } from 'next/server';
import { getLiveMovies } from '@/lib/bfilmy/source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Public, unauthenticated, read-only -- served from the box-office data the
// BFILMY sync job stores in Supabase (see lib/bfilmy/source.ts).
export async function GET() {
  try {
    const movies = await getLiveMovies();
    return NextResponse.json({ movies, count: movies.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Could not load current movies right now' }, { status: 502 });
  }
}
