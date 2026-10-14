// Which source owns which data. One switch, read everywhere:
//
//   FYRE_SOURCE_POLICY=moviemint_india
//     catalog + metadata + every India figure  -> MovieMint (mmi_* tables)
//     every USA figure                         -> BFILMY USA (us_* tables),
//                                                 only for MovieMint movies
//   unset (default)
//     the previous behaviour: BFILMY-first catalog, BFILMY India (bf_*)
//
// Switching it back off returns every page to the bf_* tables, which the
// policy never modifies. Ingestion has its own switches:
//   MOVIEMINT_INDIA_SYNC=1   scheduled MovieMint catalog + India import
//   BFILMY_INDIA_SYNC=0      stop scheduled BFILMY India ingestion (only
//                            after the MovieMint importer is validated;
//                            stored BFILMY India history is never deleted)
export type SourcePolicy = 'moviemint_india' | 'bfilmy';

export function sourcePolicy(): SourcePolicy {
  return process.env.FYRE_SOURCE_POLICY === 'moviemint_india' ? 'moviemint_india' : 'bfilmy';
}

export function moviemintIndia(): boolean {
  return sourcePolicy() === 'moviemint_india';
}

export function moviemintIndiaSyncEnabled(): boolean {
  return process.env.MOVIEMINT_INDIA_SYNC === '1';
}

export function bfilmyIndiaSyncEnabled(): boolean {
  return process.env.BFILMY_INDIA_SYNC !== '0';
}

// The India tables / SQL helpers for the active policy. Same shapes either
// way (mmi_* mirror bf_*), so callers only swap names.
export function indiaTables() {
  return moviemintIndia()
    ? {
        source: 'moviemint' as const,
        movie: 'mmi_movie',
        day: 'mmi_movie_day',
        days: 'mmi_movie_days',
        cumulative: 'mmi_movie_cumulative',
        summarySum: 'mmi_summary_dim_sum',
        // MovieMint publishes no show-level file: no venue / PIC / show-hour
        // / price-band / language-by-state data, no chain lists.
        showLevel: false
      }
    : {
        source: 'bfilmy' as const,
        movie: 'bf_movie',
        day: 'bf_movie_day',
        days: 'bf_movie_days',
        cumulative: 'bf_movie_cumulative',
        summarySum: 'bf_summary_dim_sum',
        showLevel: true
      };
}
