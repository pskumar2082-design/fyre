# fyre — Next.js + Supabase rebuild

This is a real, independently-hosted starting point for fyre, built to eventually
live at **fyre.com** with no claude.ai in the URL at all.

## What's already built
- Home page pulling News, Reviews, Gallery, Live box office, Now showing, and
  Upcoming releases live from a real database (Supabase/Postgres)
- A news article detail page and a review detail page, each with a full-length
  body, image, and byline — matching the artifact version's design
- An admin panel at `/admin`, protected by real sign-in (Supabase Auth), with
  full add/edit/delete for all six sections — **News, Reviews, Gallery, Live
  box office, Now showing, and Upcoming** — each in its own tab
- Image upload wired to Supabase Storage for every section
- The same dark, cinematic visual style (colors, fonts) as the Claude artifact
  version, via Tailwind

## Admin panel structure
`app/admin/page.tsx` drives all six tabs from one config-driven `Dashboard`
component instead of six copy-pasted ones: a `SECTIONS` array describes each
table's fields, validation, image handling, and how each row is summarized in
the list. To add a new manageable table later, add a table to
`supabase/schema.sql` and one entry to `SECTIONS` — the load/add/edit/delete
logic and the form + list UI are shared automatically.

## 1. Create a Supabase project
1. Go to https://supabase.com, create a free account and a new project.
2. Open the SQL Editor and run everything in `supabase/schema.sql` — this
   creates all six tables, sets up permissions, and creates the image storage
   bucket.
3. Go to Authentication → Users → Add user, and create yourself an
   email + password account. This is what you'll sign into `/admin` with —
   there's no separate "owner" concept like the Claude artifact had; whoever
   has valid Supabase login credentials can manage the site.
4. Go to Project Settings → API and copy the **Project URL** and **anon
   public key**.

## 2. Run it locally
```bash
cp .env.local.example .env.local
# paste your Supabase URL and anon key into .env.local

npm install
npm run dev
```
Open http://localhost:3000 — the home page should load (empty at first), and
http://localhost:3000/admin lets you sign in and start adding news stories.

## 3. Deploy to Vercel
1. Push this project to a GitHub repository.
2. Go to https://vercel.com, sign in, and "Import Project" from that repo.
3. In the Vercel project's Environment Variables settings, add the same two
   variables from your `.env.local`.
4. Deploy. Vercel gives you a `your-project.vercel.app` URL immediately.

## 4. Connect fyre.com
1. In the Vercel project, go to Settings → Domains and add `fyre.com`.
2. Vercel will show you DNS records (usually an A record or CNAME) to add at
   your domain registrar (GoDaddy, Namecheap, etc.).
3. Once DNS propagates (minutes to a couple of hours), fyre.com serves this
   site directly — no forwarding, no claude.ai anywhere in the URL.

## 5. (Optional) Automatic box-office sync

Movie stat cards on `/now-showing/[id]` can fill themselves in from a public
box-office article (e.g. a Sacnilk "Day Wise" page) instead of typing every
number by hand. It only ever reads a published article's own text — never a
booking flow or anything gated behind login — see `lib/sacnilkParser.ts` for
exactly what's parsed and why.

1. Run `supabase/migration_scraper.sql` in the Supabase SQL editor.
2. In Supabase → Project Settings → API, copy the **service_role** key
   (different from the anon key — keep this one secret, never in the
   browser or in chat).
3. Generate a random secret for `CRON_SECRET`, e.g. `openssl rand -hex 32`.
4. In Vercel → your project → Settings → Environment Variables, add
   `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` (same names as
   `.env.local.example`). Add them to `.env.local` too if you want to test
   sync locally.
5. In `/admin` → Now showing, edit a movie and paste its Sacnilk day-wise
   article URL into "Box office source", then click **Sync now** on that
   movie's row.
6. `vercel.json` schedules this to run automatically once a day for every
   movie that has a source URL set (Vercel Cron — the free Hobby plan
   allows once-daily schedules; Pro allows more frequent).

This is best-effort: if Sacnilk changes their page layout, syncs will
quietly find nothing rather than break the site — re-check the selectors in
`lib/sacnilkParser.ts` against a current article if that happens. State/
language/format breakdown stays manual, since that level of detail is
paywalled on the sites checked.

## Notes
- Every table's Row Level Security policy lets **anyone** read data (so the
  public site works) but only **signed-in** users can write — matching the
  "public site, admin-only editing" behavior from the Claude artifact.
- Image files go to a public Supabase Storage bucket called `images`, so any
  URL is safe to put directly on the page.
- `revalidate = 30` on the home page means new content shows up within 30
  seconds without needing a full redeploy.
