-- Fyre v2: newsroom (News and Politics written by Fyre). Nov 2026.
--
-- NOT RUN. Hand-run in the Supabase SQL Editor only after explicit approval.
-- ADDITIVE ONLY: creates new cms_* tables, seeds the 13 starting categories
-- and the 6 homepage sections, and adds one view-counter function. The
-- existing `news` and `reviews` tables are not touched; /news/<uuid> keeps
-- serving the old articles. Safe to re-run.
-- Undo: supabase/down_cms_1.sql.

create table if not exists cms_category (
  section text not null check (section in ('news', 'politics')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  sort int not null default 99,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (section, slug)
);

create table if not exists cms_article (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('news', 'politics')),
  category text not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  headline text not null check (char_length(headline) between 1 and 160),
  description text not null default '',
  body_html text not null default '',
  hero_image_url text,
  hero_image_alt text not null default '',
  image_credit text not null default '',
  tags text[] not null default '{}',
  sources jsonb not null default '[]'::jsonb,  -- [{name,url,checkedOn}]
  kind text not null default 'report' check (kind in ('report', 'analysis', 'opinion', 'explainer')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'unpublished')),
  publish_at timestamptz,
  published_at timestamptz,
  author text,
  featured_rank int check (featured_rank between 1 and 5),
  fact_checked_by text,
  fact_checked_at timestamptz,
  seo_title text not null default '',
  seo_description text not null default '',
  correction_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section, slug),
  foreign key (section, category) references cms_category (section, slug),
  -- Politics cannot go public without a source and a fact-checker (also
  -- enforced in the admin; this is the database backstop).
  constraint cms_politics_checked check (
    section <> 'politics' or status in ('draft', 'unpublished')
    or (jsonb_array_length(sources) > 0 and coalesce(fact_checked_by, '') <> '')
  )
);
create index if not exists cms_article_public_idx on cms_article (section, category, publish_at desc) where status in ('published', 'scheduled');
create index if not exists cms_article_tags_idx on cms_article using gin (tags);
create index if not exists cms_article_featured_idx on cms_article (featured_rank) where featured_rank is not null;

create table if not exists cms_article_revision (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references cms_article (id),
  edited_by text,
  edited_at timestamptz not null default now(),
  note text not null default '',
  snapshot jsonb not null
);
create index if not exists cms_article_revision_article_idx on cms_article_revision (article_id, edited_at desc);

-- Renamed slugs keep working.
create table if not exists cms_slug_redirect (
  section text not null,
  old_slug text not null,
  article_id uuid not null references cms_article (id),
  created_at timestamptz not null default now(),
  primary key (section, old_slug)
);

create table if not exists cms_breaking_banner (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 140),
  link text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  created_by text,
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists cms_home_section (
  key text primary key check (key in ('headlines', 'cricket', 'now_showing', 'box_office', 'politics', 'trending')),
  label text not null,
  enabled boolean not null default true,
  sort int not null
);

-- Anonymous daily view counts for Trending Stories (no personal data).
create table if not exists cms_article_view_day (
  article_id uuid not null references cms_article (id),
  day date not null,
  views int not null default 0,
  primary key (article_id, day)
);

create or replace function cms_record_view(p_article uuid, p_day date)
returns void language sql security definer set search_path = public as $$
  insert into cms_article_view_day (article_id, day, views) values (p_article, p_day, 1)
  on conflict (article_id, day) do update set views = cms_article_view_day.views + 1;
$$;
revoke all on function cms_record_view(uuid, date) from public, anon, authenticated;

-- Seeds (only rows that are missing).
insert into cms_category (section, slug, name, description, sort) values
  ('news', 'breaking', 'Breaking News', 'Developing stories as they happen.', 1),
  ('news', 'india', 'India', 'News from across India.', 2),
  ('news', 'world', 'World', 'International news.', 3),
  ('news', 'andhra-pradesh', 'Andhra Pradesh', 'News from Andhra Pradesh.', 4),
  ('news', 'telangana', 'Telangana', 'News from Telangana.', 5),
  ('news', 'entertainment', 'Entertainment', 'Films, OTT, music and celebrities.', 6),
  ('news', 'technology', 'Technology', 'Technology news.', 7),
  ('politics', 'india', 'Indian Politics', 'National politics and Parliament.', 1),
  ('politics', 'andhra-pradesh', 'Andhra Pradesh Politics', 'Politics in Andhra Pradesh.', 2),
  ('politics', 'telangana', 'Telangana Politics', 'Politics in Telangana.', 3),
  ('politics', 'elections', 'Elections', 'Elections, schedules and official results.', 4),
  ('politics', 'government', 'Government Announcements', 'Official announcements from the Centre and the states.', 5),
  ('politics', 'policy', 'Policies and Legislation', 'Bills, Acts and policy decisions.', 6)
on conflict (section, slug) do nothing;

insert into cms_home_section (key, label, enabled, sort) values
  ('headlines', 'Latest Headlines', true, 1),
  ('cricket', 'Live Cricket Scores', true, 2),
  ('now_showing', 'Now Showing Telugu Movies', true, 3),
  ('box_office', 'Box Office Collections', true, 4),
  ('politics', 'Political Updates', true, 5),
  ('trending', 'Trending Stories', true, 6)
on conflict (key) do nothing;

-- Row Level Security. Public: categories, homepage sections, banners and
-- ONLY published articles whose time has come. Drafts, scheduled-but-not-yet
-- articles, revisions, redirects' targets and view counts are service-role
-- only (the admin API routes check the signed-in admin first).
alter table cms_category enable row level security;
alter table cms_article enable row level security;
alter table cms_article_revision enable row level security;
alter table cms_slug_redirect enable row level security;
alter table cms_breaking_banner enable row level security;
alter table cms_home_section enable row level security;
alter table cms_article_view_day enable row level security;
drop policy if exists "cms_category public read" on cms_category;
create policy "cms_category public read" on cms_category for select using (true);
drop policy if exists "cms_article public read" on cms_article;
create policy "cms_article public read" on cms_article for select using (status in ('published', 'scheduled') and publish_at is not null and publish_at <= now());
drop policy if exists "cms_slug_redirect public read" on cms_slug_redirect;
create policy "cms_slug_redirect public read" on cms_slug_redirect for select using (true);
drop policy if exists "cms_breaking_banner public read" on cms_breaking_banner;
create policy "cms_breaking_banner public read" on cms_breaking_banner for select using (true);
drop policy if exists "cms_home_section public read" on cms_home_section;
create policy "cms_home_section public read" on cms_home_section for select using (true);
