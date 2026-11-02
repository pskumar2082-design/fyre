-- Fyre v2, Phase 1: Sports (cricket). Nov 2026.
--
-- NOT RUN. Hand-run in the Supabase SQL Editor only after explicit approval.
-- ADDITIVE ONLY: creates new sp_* tables. No existing table is touched.
-- Safe to re-run (every statement is guarded).
-- Undo: supabase/down_sports_1.sql drops exactly these tables.
--
-- Filled only by the scheduled sync (lib/sports/sync.ts), which stays off
-- until SPORTS_SYNC_ENABLED=1 and HIGHLIGHTLY_API_KEY are set (separate
-- approval). Visitors read these tables; they never call the provider.

create table if not exists sp_competition (
  id text primary key,                         -- '<provider>:<provider id>'
  provider text not null,
  name text not null,
  short text,
  kind text not null default 'international' check (kind in ('international', 'league', 'domestic')),
  season text,
  is_ipl boolean not null default false,
  followed boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists sp_match (
  id text primary key,                         -- '<provider>:<provider id>'
  sport text not null default 'cricket',
  provider text not null,
  provider_id text not null,
  competition_id text references sp_competition (id),
  format text not null check (format in ('TEST', 'ODI', 'T20I', 'T20', 'OTHER')),
  title text,
  start_time timestamptz not null,
  venue text,
  teams jsonb not null,                        -- [{id,name,short,isIndia}, {...}]
  state text not null check (state in ('scheduled', 'live', 'innings_break', 'stumps', 'delayed', 'completed', 'abandoned', 'no_result', 'unknown')),
  status_text text,
  innings jsonb not null default '[]'::jsonb,  -- [{teamId,runs,wickets,overs,...}] as sent; missing values stay null
  target int,
  overs_limit int,
  result_text text,
  winner_team_id text,
  provider_updated_at timestamptz,
  fetched_at timestamptz not null default now(),
  source text not null,
  unique (provider, provider_id)
);
create index if not exists sp_match_start_idx on sp_match (start_time);
create index if not exists sp_match_state_idx on sp_match (state, start_time);

create table if not exists sp_scorecard (
  match_id text primary key references sp_match (id) on delete cascade,
  toss text,
  player_of_match text,
  innings jsonb not null default '[]'::jsonb,  -- InningsCard[] (batting, bowling, extras, fall of wickets)
  source text not null,                        -- 'highlightly' | 'cricsheet'
  attribution text,                            -- e.g. the Cricsheet ODC-BY credit
  provider_updated_at timestamptz,
  fetched_at timestamptz not null default now()
);

create table if not exists sp_standing (
  competition_id text not null references sp_competition (id),
  position int not null,
  team jsonb not null,
  played int,
  won int,
  lost int,
  no_result int,
  points int,
  nrr numeric,
  updated_at timestamptz not null default now(),
  primary key (competition_id, position)
);

-- Every provider request, for the daily budget (100/day on the free plan).
create table if not exists sp_call_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  provider text not null,
  endpoint text not null,
  status int,
  ms int,
  ok boolean,
  remaining int
);
create index if not exists sp_call_log_provider_at_idx on sp_call_log (provider, at);

create table if not exists sp_feed_status (
  feed text primary key,                       -- 'live' | 'fixtures' | 'standings' | 'cricsheet'
  last_success timestamptz,
  last_error timestamptz,
  error_text text,
  consecutive_failures int not null default 0,
  updated_at timestamptz not null default now()
);

-- Row Level Security: anyone may read scores; only the service role writes
-- (the service role bypasses RLS, so no write policy is created).
alter table sp_competition enable row level security;
alter table sp_match enable row level security;
alter table sp_scorecard enable row level security;
alter table sp_standing enable row level security;
alter table sp_call_log enable row level security;
alter table sp_feed_status enable row level security;
drop policy if exists "sp_competition public read" on sp_competition;
create policy "sp_competition public read" on sp_competition for select using (true);
drop policy if exists "sp_match public read" on sp_match;
create policy "sp_match public read" on sp_match for select using (true);
drop policy if exists "sp_scorecard public read" on sp_scorecard;
create policy "sp_scorecard public read" on sp_scorecard for select using (true);
drop policy if exists "sp_standing public read" on sp_standing;
create policy "sp_standing public read" on sp_standing for select using (true);
-- sp_call_log, sp_feed_status: no public policy (admin / service role only).
