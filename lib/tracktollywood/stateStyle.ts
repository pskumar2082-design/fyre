import type { TTMovieState } from './types';

// Shared per-state presentation used everywhere a TrackTollywood movie's
// state shows up (MovieCard, the movie detail page, search results).
// "Live" gets the Material primary color (solid fill, same treatment as
// an active nav item or selected filter tab) plus a pulsing dot;
// "Advance" gets the secondary teal as a distinct second accent; the
// rest are plain neutral outlines that step down in brightness the
// further they are from "happening right now".
export const STATE_LABEL: Record<TTMovieState, string> = {
  live: 'Live',
  advance: 'Advance',
  upcoming: 'Upcoming',
  final: 'Final',
  unknown: ''
};

export const STATE_BADGE: Record<TTMovieState, string> = {
  live: 'bg-gold text-black',
  advance: 'bg-goldDim/15 text-goldDim border border-goldDim/40',
  upcoming: 'bg-transparent text-textFaint border border-white/10',
  final: 'bg-white/[0.03] text-textFaint border border-white/5',
  unknown: 'bg-white/[0.03] text-textFaint'
};

export function stateDotClass(state: TTMovieState): string | null {
  return state === 'live' ? 'bg-black' : null;
}
