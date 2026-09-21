import type { TTMovieState } from './types';

// Shared per-state presentation used everywhere a TrackTollywood movie's
// state shows up (MovieCard, the movie detail page, search results).
// Kept deliberately restrained -- only "live" gets the accent green +
// pulsing dot; everything else is neutral so the green stays meaningful
// as "this number is moving right now" rather than decoration.
export const STATE_LABEL: Record<TTMovieState, string> = {
  live: 'Live',
  advance: 'Advance',
  upcoming: 'Upcoming',
  final: 'Final',
  unknown: ''
};

export const STATE_BADGE: Record<TTMovieState, string> = {
  live: 'bg-gold text-black',
  advance: 'bg-amber-400/15 text-amber-300 border border-amber-400/30',
  upcoming: 'bg-white/10 text-zinc-300 border border-white/10',
  final: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
  unknown: 'bg-zinc-800 text-zinc-400'
};

export function stateDotClass(state: TTMovieState): string | null {
  return state === 'live' ? 'bg-gold' : null;
}
