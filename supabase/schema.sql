-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query).
-- Creates every table fyre needs, matching the artifact version's data shape.

create table if not exists news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text default '',
  content text default '',
  category text default 'news',
  image_url text,
  date text,
  created_at timestamptz default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  excerpt text default '',
  content text default '',
  rating text default '4',
  image_url text,
  date text,
  created_at timestamptz default now()
);

create table if not exists gallery (
  id uuid primary key default gen_random_uuid(),
  caption text default '',
  image_url text,
  created_at timestamptz default now()
);

create table if not exists live_box_office (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sub text default 'Live',
  amt numeric not null,
  image_url text,
  created_at timestamptz default now()
);

create table if not exists now_showing (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text default '',
  amt text default '',
  image_url text,
  created_at timestamptz default now()
);

create table if not exists upcoming (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  release_date date not null,
  image_url text,
  created_at timestamptz default now()
);

-- Row Level Security: anyone can read, only signed-in users (you) can write.
alter table news enable row level security;
alter table reviews enable row level security;
alter table gallery enable row level security;
alter table live_box_office enable row level security;
alter table now_showing enable row level security;
alter table upcoming enable row level security;

create policy "public read" on news for select using (true);
create policy "public read" on reviews for select using (true);
create policy "public read" on gallery for select using (true);
create policy "public read" on live_box_office for select using (true);
create policy "public read" on now_showing for select using (true);
create policy "public read" on upcoming for select using (true);

create policy "auth write" on news for all using (auth.role() = 'authenticated');
create policy "auth write" on reviews for all using (auth.role() = 'authenticated');
create policy "auth write" on gallery for all using (auth.role() = 'authenticated');
create policy "auth write" on live_box_office for all using (auth.role() = 'authenticated');
create policy "auth write" on now_showing for all using (auth.role() = 'authenticated');
create policy "auth write" on upcoming for all using (auth.role() = 'authenticated');

-- Storage bucket for images (create once, then run this to make it public-readable).
insert into storage.buckets (id, name, public) values ('images', 'images', true)
on conflict (id) do nothing;

create policy "public read images" on storage.objects for select using (bucket_id = 'images');
create policy "auth upload images" on storage.objects for insert with check (bucket_id = 'images' and auth.role() = 'authenticated');
