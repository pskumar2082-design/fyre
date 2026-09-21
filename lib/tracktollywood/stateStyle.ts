import type { TTMovieState } from './types';

// Shared per-state presentation used everywhere a TrackTollywood movie's
// state shows up (MovieCard, the movie detail page, search results).
// "Live" gets the one accent gray the palette allows (solid fill, same
// treatment as an active nav item or selected filter tab) plus a
// pulsing dot; everything else is a plain neutral outline that steps
// down in brightness the further it is from "happening right now" --
// hierarchy from value, not hue.
export const STATE_LABEL: Record<TTMovieState, string> = {
  live: 'Live',
  advance: 'Advance',
  upcoming: 'Upcoming',
  final: 'Final',
  unknown: ''
};

export const STATE_BADGE: Record<TTMovieState, string> = {
  live: 'bg-gold text-black',
  advance: 'bg-white/5 text-textDim border border-white/20',
  upcoming: 'bg-transparent text-textFaint border border-white/10',
  final: 'bg-white/[0.03] text-textFaint border border-white/5',
  unknown: 'bg-white/[0.03] text-textFaint'
};

export function stateDotClass(state: TTMovieState): string | null {
  return state === 'live' ? 'bg-black' : null;
}
