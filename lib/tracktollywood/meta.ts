import type { TTMovieMetaItem } from './types';

// A TTMovieDetails page's own "Released On"/"Releasing On" meta item
// (e.g. "Released 18 Sep 2026") -- TTMovieDetails itself doesn't carry a
// releaseText field the way the hub-listing TTListedMovie does (see
// ./types.ts), so both the comparison feature (a CLIENT component,
// app/compare/ComparePageClient.tsx) and the comparison poster builder
// (a server-only module, lib/poster/buildComparison.ts) need this same
// lookup to recover a real, sourced release date/text from a movie's own
// meta list rather than inventing one.
//
// Deliberately its own tiny, dependency-free file rather than living in
// lib/tracktollywood/scraper.ts (where parseReleaseDate, its natural
// pairing, already lives): scraper.ts pulls in axios + cheerio for its
// actual scraping work, and importing even one pure helper from it into
// a 'use client' file drags both of those Node-only libraries into the
// browser bundle. That exact mistake briefly bloated /compare's client
// JS from ~7KB to ~120KB before this file existed -- caught by
// `next build`'s own per-route size output, not by any type error, so
// it's worth this comment as a guardrail against reintroducing it.
export function releaseTextFromMeta(meta: TTMovieMetaItem[]): string | null {
  return meta.find((m) => /^released|releasing/i.test(m.label))?.value ?? null;
}
