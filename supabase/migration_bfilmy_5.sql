-- MovieMint decides WHICH movies Fyre tracks; BFILMY provides the data.
-- Additive only. Safe to run more than once.

-- 1. MovieMint's tracked-movie list, as last seen (identity fields only --
--    MovieMint's own gross/ticket figures are deliberately not stored).
create table if not exists mm_movie (
  moviemint_id text primary key,
  title text not null,
  language text,
  release_date date,
  poster text,
  badge text,
  source_url text not null,
  last_tracked_date date,
  on_list boolean not null default true,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. The Fyre tracking decision for each MovieMint movie: which BFILMY
--    movie it is, how sure we are, and whether Fyre is tracking it.
--    match_status:    matched | needs_review | unmatched | rejected
--    tracking_status: active (syncing) | ended (left MovieMint, history kept)
--                     | stopped (admin stopped it, history kept) | pending
create table if not exists fyre_tracked_movie (
  moviemint_id text primary key references mm_movie (moviemint_id),
  bf_slug text,
  match_status text not null default 'needs_review' check (match_status in ('matched', 'needs_review', 'unmatched', 'rejected')),
  match_confidence text,
  match_method text,
  match_note text,
  candidates jsonb not null default '[]'::jsonb,
  tracking_status text not null default 'pending' check (tracking_status in ('active', 'ended', 'stopped', 'pending')),
  ended_at timestamptz,
  backfill_status text,
  backfill_requested_at timestamptz,
  backfill_done_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists fyre_tracked_movie_bf_slug_uidx on fyre_tracked_movie (bf_slug) where match_status = 'matched';

alter table mm_movie enable row level security;
alter table fyre_tracked_movie enable row level security;
drop policy if exists "mm_movie public read" on mm_movie;
create policy "mm_movie public read" on mm_movie for select using (true);
drop policy if exists "fyre_tracked_movie public read" on fyre_tracked_movie;
create policy "fyre_tracked_movie public read" on fyre_tracked_movie for select using (true);

-- 3. Retention. Core day totals (bf_movie_day.totals, bf_movie_day_detail)
--    are permanent. Breakdowns older than p_keep_days are removed in
--    batches: bf_movie_breakdown rows are deleted, and the summary file's
--    state/city/chain lists in bf_movie_day.breakdown are emptied (the
--    small language/format lists and per-version entries are kept -- they
--    describe which versions a movie had). breakdown_pruned marks those
--    days so nothing ever adds up a partial breakdown.
alter table bf_movie_day add column if not exists breakdown_pruned boolean not null default false;

create or replace function bf_prune_breakdowns(p_keep_days int default 90, p_dry_run boolean default true, p_batch int default 2000)
returns jsonb
language plpgsql as $$
declare
  cutoff date := (now() at time zone 'Asia/Kolkata')::date - p_keep_days;
  n_detail int;
  n_summary int;
begin
  if p_dry_run then
    select count(*) into n_detail from bf_movie_breakdown where date < cutoff;
    select count(*) into n_summary from bf_movie_day where date < cutoff and not breakdown_pruned;
    return jsonb_build_object('cutoff', cutoff, 'dry_run', true, 'breakdown_rows', n_detail, 'summary_days', n_summary);
  end if;
  with doomed as (
    select slug, kind, date, dimension from bf_movie_breakdown where date < cutoff limit p_batch
  ), gone as (
    delete from bf_movie_breakdown b using doomed d
    where b.slug = d.slug and b.kind = d.kind and b.date = d.date and b.dimension = d.dimension
    returning 1
  )
  select count(*) into n_detail from gone;
  with doomed as (
    select slug, kind, date from bf_movie_day where date < cutoff and not breakdown_pruned limit p_batch
  ), done as (
    update bf_movie_day m set
      breakdown = jsonb_build_object(
        'entries', coalesce(m.breakdown->'entries', '[]'::jsonb),
        'languages', coalesce(m.breakdown->'languages', '[]'::jsonb),
        'formats', coalesce(m.breakdown->'formats', '[]'::jsonb)
      ),
      breakdown_pruned = true
    from doomed d
    where m.slug = d.slug and m.kind = d.kind and m.date = d.date
    returning 1
  )
  select count(*) into n_summary from done;
  return jsonb_build_object('cutoff', cutoff, 'dry_run', false, 'breakdown_rows', n_detail, 'summary_days', n_summary);
end;
$$;

-- Raw show rows: box office for the last p_keep_days, advance only while
-- the date is still open (today or later). Only for dates whose permanent
-- aggregates are complete.
create or replace function bf_prune_shows(p_keep_days int default 7, p_dry_run boolean default true)
returns int
language plpgsql as $$
declare
  n int;
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if p_dry_run then
    select count(*) into n from bf_show s
    join bf_detail_file f on f.kind = s.kind and f.date = s.date
    where f.aggregates_complete
      and ((s.kind = 'boxoffice' and s.date < today - p_keep_days and f.final) or (s.kind = 'advance' and s.date < today));
    return n;
  end if;
  with gone as (
    delete from bf_show s using bf_detail_file f
    where f.kind = s.kind and f.date = s.date and f.aggregates_complete
      and ((s.kind = 'boxoffice' and s.date < today - p_keep_days and f.final) or (s.kind = 'advance' and s.date < today))
    returning 1
  )
  select count(*) into n from gone;
  update bf_detail_file f set shows_stored = 0
    where f.shows_stored > 0 and f.aggregates_complete
      and ((f.kind = 'boxoffice' and f.date < today - p_keep_days and f.final) or (f.kind = 'advance' and f.date < today));
  return n;
end;
$$;

revoke execute on function bf_prune_breakdowns(int, boolean, int) from public, anon, authenticated;
revoke execute on function bf_prune_shows(int, boolean) from public, anon, authenticated;
notify pgrst, 'reload schema';
