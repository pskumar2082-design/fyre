-- Fyre owns its movie catalog; BFILMY is the discovery source.
-- Only the last 90 days of BFILMY activity are discovered/imported for new
-- movies; ongoing movies keep being tracked for as long as BFILMY reports
-- them (no maximum run).
--
-- A Fyre movie (fyre_tracked_movie row) is discovered from BFILMY India /
-- BFILMY USA listings by the scheduled sync (or created/matched by an
-- admin). MovieMint is optional legacy enrichment only: nothing here, and
-- no Fyre movie, needs an mm_movie row.
--
-- Safe to run more than once. Nothing is deleted: mm_movie, MovieMint
-- history, existing MovieMint mappings and every existing id stay.
-- moviemint_id stays the primary key and is the canonical Fyre movie id
-- (existing ids unchanged; new ones are 'fyre-xxxxxxxx'). Renaming that
-- column is a separate, later migration.

-- 1. Canonical catalog fields.
alter table fyre_tracked_movie add column if not exists origin text not null default 'moviemint';
alter table fyre_tracked_movie add column if not exists title text;                 -- canonical title (from the source listing)
alter table fyre_tracked_movie add column if not exists release_year int;
alter table fyre_tracked_movie add column if not exists release_date date;          -- only when actually known (never guessed)
alter table fyre_tracked_movie add column if not exists languages text[];
alter table fyre_tracked_movie add column if not exists first_source_date date;     -- first date the creating listing had shows
alter table fyre_tracked_movie add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table fyre_tracked_movie add column if not exists metadata_status text;       -- complete | incomplete
alter table fyre_tracked_movie add column if not exists created_from text;          -- 'bfilmy_india:<title key>' | 'bfilmy_usa:<id>'
-- 90-day rule: Fyre imports at most the last 90 days of a newly discovered
-- movie. history_complete = false when that cut a long run short: its
-- totals are a "tracked period", never "lifetime". India and USA apart.
alter table fyre_tracked_movie add column if not exists history_start_date date;
alter table fyre_tracked_movie add column if not exists history_complete boolean;
alter table fyre_tracked_movie add column if not exists us_history_start_date date;
alter table fyre_tracked_movie add column if not exists us_history_complete boolean;
-- (Re)created so an earlier run of this file ends with exactly these values.
alter table fyre_tracked_movie drop constraint if exists fyre_tracked_movie_origin_check;
alter table fyre_tracked_movie add constraint fyre_tracked_movie_origin_check
  check (origin in ('moviemint', 'bfilmy_india', 'bfilmy_usa', 'admin'));
-- One Fyre movie per creating listing: a sync that runs twice cannot create
-- the same movie twice.
create unique index if not exists fyre_tracked_movie_created_from_uidx on fyre_tracked_movie (created_from) where created_from is not null;

-- 2. No Fyre movie depends on MovieMint: drop every foreign key from
--    fyre_tracked_movie / us_movie_map to mm_movie (mm_movie itself stays).
do $$
declare r record;
begin
  for r in
    select c.conname, t.relname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_class f on f.oid = c.confrelid
    where c.contype = 'f' and f.relname = 'mm_movie' and t.relname in ('fyre_tracked_movie', 'us_movie_map')
  loop
    execute format('alter table %I drop constraint %I', r.relname, r.conname);
  end loop;
end $$;
-- A USA listing can only point at a Fyre movie (checked for new rows).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'us_movie_map_movie_fk') then
    alter table us_movie_map add constraint us_movie_map_movie_fk
      foreign key (movie_id) references fyre_tracked_movie (moviemint_id) not valid;
  end if;
end $$;

-- 3. MovieMint no longer decides whether a movie is active. Movies it had
--    marked 'ended' (left its list) are tracked again; an admin 'stopped'
--    stays stopped.
update fyre_tracked_movie set tracking_status = 'active', ended_at = null
where match_status = 'matched' and tracking_status = 'ended';

-- 3b. Fyre owns the canonical fields of existing movies too: copy them
--     once from what is already stored (title: MovieMint's stored list,
--     else the BFILMY movie; release date: only MovieMint's stored date,
--     never guessed; languages: the BFILMY movie). Only empty fields are
--     filled; nothing is overwritten; ids, slugs and URLs do not change.
update fyre_tracked_movie t set title = m.title
from mm_movie m where m.moviemint_id = t.moviemint_id and t.title is null and m.title is not null;
update fyre_tracked_movie t set title = b.title
from bf_movie b where b.slug = t.bf_slug and t.title is null and b.title is not null;
update fyre_tracked_movie t set release_date = m.release_date::date
from mm_movie m where m.moviemint_id = t.moviemint_id and t.release_date is null and m.release_date is not null;
update fyre_tracked_movie set release_year = extract(year from release_date)::int
where release_year is null and release_date is not null;
update fyre_tracked_movie t set languages = b.languages
from bf_movie b where b.slug = t.bf_slug and t.languages is null and b.languages is not null;
-- Existing movies keep exactly what they show today: their history was
-- imported in full (a movie already running on 1 Jan 2025 stays "carried
-- over" through bf_movie as before).
update fyre_tracked_movie t set history_start_date = b.first_date
from bf_movie b where b.slug = t.bf_slug and t.history_start_date is null and b.first_date is not null;
update fyre_tracked_movie set history_complete = true
where history_complete is null and match_status = 'matched' and origin = 'moviemint';
update fyre_tracked_movie t set us_history_start_date = d.first
from (select movie_id, min(report_date) as first from us_movie_day where kind = 'boxoffice' group by movie_id) d
where d.movie_id = t.moviemint_id and t.us_history_start_date is null;
update fyre_tracked_movie set us_history_complete = true
where us_history_complete is null and us_history_start_date is not null and origin = 'moviemint';

-- 4. Every source listing of a Fyre movie, kept permanently: source,
--    source title, source id/key, canonical movie, how matched, how sure,
--    the decision and when. A listing taken off a movie keeps its row with
--    the decision changed. Source records are never renamed.
create table if not exists fyre_movie_alias (
  id bigserial primary key,
  movie_id text not null references fyre_tracked_movie (moviemint_id),
  source text not null check (source in ('moviemint', 'bfilmy_india', 'bfilmy_usa', 'admin')),
  source_title text not null,
  source_key text,
  source_movie_id text,
  match_method text,
  match_confidence text,
  decision text not null default 'matched' check (decision in ('created', 'matched', 'unmatched', 'rejected')),
  decided_by text,
  decided_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);
-- Upgrades a table created by an earlier run of this file.
alter table fyre_movie_alias add column if not exists decided_at timestamptz not null default now();
alter table fyre_movie_alias drop constraint if exists fyre_movie_alias_source_check;
alter table fyre_movie_alias add constraint fyre_movie_alias_source_check
  check (source in ('moviemint', 'bfilmy_india', 'bfilmy_usa', 'admin'));
alter table fyre_movie_alias drop constraint if exists fyre_movie_alias_decision_check;
alter table fyre_movie_alias add constraint fyre_movie_alias_decision_check
  check (decision in ('created', 'matched', 'unmatched', 'rejected'));
create index if not exists fyre_movie_alias_movie_idx on fyre_movie_alias (movie_id);
create index if not exists fyre_movie_alias_source_idx on fyre_movie_alias (source, source_movie_id);

-- 5. BFILMY India listings (identity only: title, dates seen, languages --
--    never figures for a title that is not a Fyre movie).
create table if not exists bf_listing (
  key text primary key,
  source_title text not null,
  movie_id text references fyre_tracked_movie (moviemint_id),
  match_status text not null default 'unmatched' check (match_status in ('matched', 'needs_review', 'unmatched', 'rejected')),
  match_confidence text,
  match_method text,
  match_note text,
  candidates jsonb not null default '[]'::jsonb,
  languages text[],
  first_date date,
  last_date date,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table bf_listing drop constraint if exists bf_listing_match_status_check;
alter table bf_listing add constraint bf_listing_match_status_check
  check (match_status in ('matched', 'needs_review', 'unmatched', 'rejected'));
create index if not exists bf_listing_status_idx on bf_listing (match_status, last_date desc);
create index if not exists bf_listing_movie_idx on bf_listing (movie_id);

-- Admin-only (they name every source title and id).
alter table fyre_movie_alias enable row level security;
alter table bf_listing enable row level security;

-- 6. Neutral wording for existing unmatched USA listings (status unchanged).
update us_movie_map set match_note = 'No existing Fyre movie match' where match_note = 'Not a MovieMint-tracked movie';

notify pgrst, 'reload schema';
