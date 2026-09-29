-- BFILMY update 3 (29 Sep 2026). Run once in Supabase SQL Editor, after
-- migration_bfilmy_2.sql. Safe to re-run. The two ALTER lines can take a
-- minute on a full table -- let them finish.
--
-- 1. Small stored copies of each day's language/format lists so the
--    per-film summary refresh stays fast on long runs.
-- 2. The release-date (Day 1) rule validated against known release dates.

alter table bf_movie_day add column if not exists lang_list jsonb generated always as (breakdown->'languages') stored;
alter table bf_movie_day add column if not exists format_list jsonb generated always as (breakdown->'formats') stored;

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
      select l->>'name' from bf_movie_day d, jsonb_array_elements(d.lang_list) l
      where d.slug = s.slug group by 1 order by sum((l->>'gross')::numeric) desc
    ),
    array(
      select f->>'name' from bf_movie_day d, jsonb_array_elements(d.format_list) f
      where d.slug = s.slug group by 1 order by sum((f->>'gross')::numeric) desc
    ),
    case
      when bo.first_date <= date '2025-01-01' then null      -- released before the archive starts: unknown
      else coalesce(pr.d1, adv.first_adv)
    end,
    case when bo.first_date > date '2025-01-01' then pr.d0 end,
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
  -- Day 1 (release date): the day show counts jump -- the largest
  -- day-over-day rise (at least 3x) among the film's first 21 box-office
  -- days, counting only days with at least 5% of the peak show count. If
  -- there is no such jump (a film already big on its first listed day, or
  -- a slow-burn opener) it's the first day with at least 5% of peak. If
  -- the chosen day still has under 20% of the next day's shows it was a
  -- preview day, and the next day is Day 1. BFILMY lists stray shows days
  -- before most releases; those count in totals but aren't Day 1.
  -- Checked against 38 films with known release dates: 37 match; the
  -- miss (Laalo) has 0 shows in BFILMY's data on its real release day.
  -- d0 = the day just before Day 1, if it had shows ("Day 0 (Pre-release)").
  left join lateral (
    with early as (
      select x.date, (x.totals->>'shows')::numeric as shows, row_number() over (order by x.date) as rn
      from (select d.date, d.totals from bf_movie_day d where d.slug = s.slug and d.kind = 'boxoffice' order by d.date limit 21) x
    ),
    pk as (select max(shows) as peak from early),
    jumps as (
      select e.date, e.shows / greatest(p.shows, 1) as j
      from early e join early p on p.rn = e.rn - 1 and e.date = p.date + 1, pk
      where e.shows >= 0.05 * pk.peak
    ),
    best as (select date, j from jumps order by j desc, date limit 1),
    base as (
      select case
        when (select j from best) >= 3 then (select date from best)
        else (select min(e.date) from early e, pk where e.shows >= 0.05 * pk.peak)
      end as r
    ),
    fwd as (
      select case when nx.date = b.r + 1 and cur.shows < 0.2 * nx.shows then nx.date else b.r end as rel
      from base b
      left join early cur on cur.date = b.r
      left join lateral (select e.date, e.shows from early e where e.date > b.r order by e.date limit 1) nx on true
    )
    select fwd.rel as d1, (select e.date from early e where e.date = fwd.rel - 1) as d0
    from fwd
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
