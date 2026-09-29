-- BFILMY update 2 (29 Sep 2026). Run once in Supabase SQL Editor, after
-- migration_bfilmy.sql. Safe to re-run. (Also included in
-- migration_bfilmy.sql for fresh setups.)
--
-- Adds: stable per-film URLs (bf_title_key), a flag for films released
-- before BFILMY's archive starts, and corrected Day 1 / premiere logic.

alter table bf_movie add column if not exists carried_over boolean not null default false;

-- One stable URL slug + display title per film identity (normalized
-- title key, lib/bfilmy/normalize.ts groupKey), fixed the first time the
-- film is seen, so spelling variants across days never split one film
-- into two pages. Written only by the sync job.
create table if not exists bf_title_key (
  key text primary key,
  slug text not null unique,
  title text not null,
  created_at timestamptz not null default now()
);
alter table bf_title_key enable row level security;
create index if not exists bf_movie_last_date_idx on bf_movie (last_date);
create index if not exists bf_movie_advance_date_idx on bf_movie (advance_date);

create or replace function bf_refresh_movies(p_slugs text[]) returns void
language sql as $$
  insert into bf_movie as m (
    slug, title, languages, formats, release_date, premiere_date, carried_over, first_date, last_date, days_tracked,
    total_gross, total_sold, total_shows, total_seats, latest, best, advance, advance_date,
    source_updated, updated_at
  )
  select
    s.slug,
    (select d.title from bf_movie_day d where d.slug = s.slug order by d.date desc limit 1),
    array(
      select l->>'name' from bf_movie_day d, jsonb_array_elements(d.breakdown->'languages') l
      where d.slug = s.slug group by 1 order by sum((l->>'gross')::numeric) desc
    ),
    array(
      select f->>'name' from bf_movie_day d, jsonb_array_elements(d.breakdown->'formats') f
      where d.slug = s.slug group by 1 order by sum((f->>'gross')::numeric) desc
    ),
    case
      when bo.first_date <= date '2025-01-01' then null      -- released before the archive starts: unknown
      when pr.is_premiere then pr.d2
      else coalesce(pr.d1, adv.first_adv)
    end,
    case when bo.first_date > date '2025-01-01' and pr.is_premiere then pr.d1 end,
    coalesce(bo.first_date <= date '2025-01-01', false),
    bo.first_date,
    bo.last_date,
    coalesce(bo.days, 0),
    coalesce(bo.total_gross, 0),
    coalesce(bo.total_sold, 0),
    coalesce(bo.total_shows, 0),
    coalesce(bo.total_seats, 0),
    (select jsonb_build_object('date', d.date) || d.totals from bf_movie_day d
      where d.slug = s.slug and d.kind = 'boxoffice' order by d.date desc limit 1),
    (select jsonb_build_object('date', d.date) || d.totals from bf_movie_day d
      where d.slug = s.slug and d.kind = 'boxoffice' order by (d.totals->>'gross')::numeric desc, d.date limit 1),
    -- The advance figure worth showing: release-day bookings for a film
    -- not yet released, tomorrow's bookings for one already running
    -- (falling back to the latest advance date if none are upcoming).
    coalesce(
      (select jsonb_build_object('date', d.date) || d.totals from bf_movie_day d
        where d.slug = s.slug and d.kind = 'advance'
          and d.date >= (now() at time zone 'Asia/Kolkata')::date + case when bo.first_date is null then 0 else 1 end
        order by d.date asc limit 1),
      (select jsonb_build_object('date', d.date) || d.totals from bf_movie_day d
        where d.slug = s.slug and d.kind = 'advance' order by d.date desc limit 1)
    ),
    adv.last_adv,
    (select d.source_updated from bf_movie_day d where d.slug = s.slug order by d.synced_at desc limit 1),
    now()
  from unnest(p_slugs) as s(slug)
  left join lateral (
    select min(d.date) as first_date, max(d.date) as last_date, count(*) as days,
           sum((d.totals->>'gross')::numeric) as total_gross,
           sum((d.totals->>'sold')::bigint) as total_sold,
           sum((d.totals->>'shows')::bigint) as total_shows,
           sum((d.totals->>'totalSeats')::bigint) as total_seats
    from bf_movie_day d where d.slug = s.slug and d.kind = 'boxoffice'
  ) bo on true
  left join lateral (
    select min(d.date) as first_adv, max(d.date) as last_adv
    from bf_movie_day d where d.slug = s.slug and d.kind = 'advance'
  ) adv on true
  -- Day 1: the first box-office day with real activity -- at least 5% of
  -- the peak daily show count within the film's first 21 box-office days.
  -- BFILMY often lists a stray show or two days before a release; those
  -- still count in the totals but don't become "Day 1".
  -- Paid premieres: if that first real day has under 20% of the next
  -- day's shows and the next day is consecutive, it's Day 0 (premieres)
  -- and the next day is Day 1 / the release date.
  left join lateral (
    with early as (
      select d.date, (d.totals->>'shows')::numeric as shows
      from bf_movie_day d where d.slug = s.slug and d.kind = 'boxoffice'
      order by d.date limit 21
    ),
    pk as (select max(shows) as peak from early),
    st as (select min(e.date) as d1 from early e, pk where e.shows >= 0.05 * pk.peak),
    first_real as (select e.shows as s1 from early e, st where e.date = st.d1),
    nx as (select e.date as d2, e.shows as s2 from early e, st where e.date > st.d1 order by e.date limit 1)
    select st.d1, nx.d2, coalesce(nx.d2 = st.d1 + 1 and first_real.s1 < 0.2 * nx.s2, false) as is_premiere
    from st left join first_real on true left join nx on true
  ) pr on true
  where exists (select 1 from bf_movie_day d where d.slug = s.slug)
  on conflict (slug) do update set
    title = excluded.title,
    languages = excluded.languages,
    formats = excluded.formats,
    release_date = excluded.release_date,
    premiere_date = excluded.premiere_date,
    carried_over = excluded.carried_over,
    first_date = excluded.first_date,
    last_date = excluded.last_date,
    days_tracked = excluded.days_tracked,
    total_gross = excluded.total_gross,
    total_sold = excluded.total_sold,
    total_shows = excluded.total_shows,
    total_seats = excluded.total_seats,
    latest = excluded.latest,
    best = excluded.best,
    advance = excluded.advance,
    advance_date = excluded.advance_date,
    source_updated = excluded.source_updated,
    updated_at = now();
$$;

revoke execute on function bf_refresh_movies(text[]) from public, anon, authenticated;
