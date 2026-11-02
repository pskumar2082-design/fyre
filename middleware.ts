import { NextRequest, NextResponse } from 'next/server';
import { blockedInSandbox } from '@/lib/v2/sandboxRoutes';

// Vercel Preview sandbox guard (feature/fyre-v2* Preview builds only; see
// lib/v2/previewEnv.js). In the sandbox every route that could write to the
// production Supabase project, run an import or call a data feed answers
// 403, so a Preview deployment can only ever show test data.
//
// Outside the sandbox (Production, other previews, local dev) this
// middleware passes every request straight through.
const SANDBOX = process.env.FYRE_PREVIEW_SANDBOX === '1' && process.env.VERCEL_ENV !== 'production';

export function middleware(req: NextRequest) {
  if (!SANDBOX) return NextResponse.next();
  if (blockedInSandbox(req.nextUrl.pathname)) {
    return NextResponse.json({ error: 'Disabled on the Fyre v2 Preview: test data only, no imports or database writes.' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
};
