import type { TTMovieState } from './types';

// Shared per-state presentation used everywhere a TrackTollywood movie's
// state shows up (MovieCard, the movie detail page). Both places overlay
// this badge on a dark poster/backdrop image, not the page background --
// that's true regardless of the site's own light/dark theme -- so these
// stay solid-color/translucent-dark chips calibrated for legibility on a
// photo, not the light-tinted style the rest of the light theme uses.
// Colors follow the "Car Rent" reference's status logic (Completed =
// green, Pending = blue, In route = red): "live" is happening right now,
// same urgency as a ride "in route"; "advance" has bookings open but
// hasn't released yet, like a ride "pending"; "final" is done, like a
// completed ride; "upcoming" is announced but nothing active yet, so it
// stays a plain translucent-dark chip.
export const STATE_LABEL: Record<TTMovieState, string> = {
  live: 'Live',
  advance: 'Advance',
  upcoming: 'Upcoming',
  final: 'Final',
  unknown: ''
};

export const STATE_BADGE: Record<TTMovieState, string> = {
  live: 'bg-red text-white',
  advance: 'bg-gold text-white',
  upcoming: 'bg-black/60 text-white/90 border border-white/10',
  final: 'bg-goldDim text-white',
  unknown: 'bg-black/60 text-white/70 border border-white/10'
};

// Contrast color for the small pulse dot on the "live" badge -- white
// against the badge's own solid red fill.
export function stateDotClass(state: TTMovieState): string | null {
  return state === 'live' ? 'bg-white' : null;
}
