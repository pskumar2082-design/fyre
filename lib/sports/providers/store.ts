import { supabase } from '@/lib/supabaseClient';
import type { Competition, Match, MatchDetail, Standings, Team } from '../types';
import type { CricketSource } from '../source';

// Reads Fyre's own sp_* tables (supabase/migration_sports_1.sql). These are
// filled only by the scheduled sync job (lib/sports/sync.ts); visitors
// never trigger a provider request.

type CompetitionRow = { id: string; name: string; short: string | null; kind: Competition['kind']; season: string | null; is_ipl: boolean | null };

export function competitionFromRow(r: CompetitionRow | null, fallbackId: string): Competition {
  if (!r) return { id: fallbackId, name: 'Cricket', short: 'Cricket', kind: 'international', season: null };
  return { id: r.id, name: r.name, short: r.short ?? r.name, kind: r.kind, season: r.season, isIpl: !!r.is_ipl };
}

export function matchFromRow(r: any): Match {
  return {
    id: r.id,
    sport: 'cricket',
    provider: r.provider,
    providerId: r.provider_id,
    competition: competitionFromRow(r.sp_competition ?? null, r.competition_id),
    format: r.format,
    title: r.title ?? '',
    startTime: r.start_time,
    venue: r.venue,
    teams: (r.teams ?? []) as [Team, Team],
    state: r.state,
    statusText: r.status_text,
    innings: r.innings ?? [],
    target: r.target,
    oversLimit: r.overs_limit,
    resultText: r.result_text,
    winnerTeamId: r.winner_team_id,
    providerUpdatedAt: r.provider_updated_at,
    fetchedAt: r.fetched_at,
    isTestData: false
  };
}

const MATCH_COLUMNS = '*, sp_competition(id, name, short, kind, season, is_ipl)';

export const storeSource: CricketSource = {
  id: 'store',
  label: 'Fyre cricket feed',
  isTestData: false,
  async listMatches(now) {
    const from = new Date(now.getTime() - 4 * 86_400_000).toISOString();
    const to = new Date(now.getTime() + 8 * 86_400_000).toISOString();
    const { data, error } = await supabase.from('sp_match').select(MATCH_COLUMNS).gte('start_time', from).lte('start_time', to).order('start_time');
    if (error) throw new Error(`sp_match: ${error.message}`);
    return (data ?? []).map(matchFromRow);
  },
  async getMatch(_now, id) {
    const { data, error } = await supabase.from('sp_match').select(`${MATCH_COLUMNS}, sp_scorecard(toss, player_of_match, innings)`).eq('id', id).maybeSingle();
    if (error) throw new Error(`sp_match: ${error.message}`);
    if (!data) return null;
    const card = Array.isArray((data as any).sp_scorecard) ? (data as any).sp_scorecard[0] : (data as any).sp_scorecard;
    const detail: MatchDetail = { ...matchFromRow(data), toss: card?.toss ?? null, playerOfMatch: card?.player_of_match ?? null, scorecard: card?.innings ?? [] };
    return detail;
  },
  async listStandings() {
    const { data, error } = await supabase
      .from('sp_standing')
      .select('*, sp_competition(id, name, short, kind, season, is_ipl)')
      .order('competition_id')
      .order('position');
    if (error) throw new Error(`sp_standing: ${error.message}`);
    const by = new Map<string, Standings>();
    for (const r of data ?? []) {
      const key = (r as any).competition_id as string;
      if (!by.has(key)) by.set(key, { competition: competitionFromRow((r as any).sp_competition, key), rows: [], updatedAt: (r as any).updated_at, isTestData: false });
      by.get(key)!.rows.push({
        position: (r as any).position,
        team: (r as any).team,
        played: (r as any).played,
        won: (r as any).won,
        lost: (r as any).lost,
        noResult: (r as any).no_result,
        points: (r as any).points,
        nrr: (r as any).nrr
      });
    }
    return [...by.values()];
  }
};
