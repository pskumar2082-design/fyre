-- X Post Designer (Admin → Social poster): where each imported post came
-- from, kept for editorial traceability. Admin-only; not publicly readable.
-- Additive. Safe to run more than once.
create table if not exists social_import (
  id bigserial primary key,
  source_url text not null,          -- canonical x.com/<handle>/status/<id>
  post_id text not null,
  author_name text,
  author_handle text,
  post_text text,                    -- the post as imported (before any edit)
  posted_at timestamptz,
  media jsonb not null default '[]'::jsonb,   -- [{type,url,width,height,alt}] (X media URLs)
  hashtags text[],
  links text[],
  mentions jsonb,
  via text,                          -- syndication | oembed
  imported_by text,                  -- admin email
  imported_at timestamptz not null default now()
);
create index if not exists social_import_post_idx on social_import (post_id);
create index if not exists social_import_time_idx on social_import (imported_at desc);
alter table social_import enable row level security;
notify pgrst, 'reload schema';
