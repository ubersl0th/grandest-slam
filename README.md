# The Grandest Slam

A four-sport summer tournament app — Padel, Tennis, Disc Golf and Golf, played in teams of two.
One Next.js app, Supabase for everything backend (Postgres, Auth, Realtime, Storage, RLS).

## Stack

- **Next.js 16** + React 19 (App Router, server components, middleware-driven auth, Turbopack dev)
- **Tailwind CSS v4** with a hand-rolled retro / sun-faded summer palette
- **Supabase**: Postgres + email/password + magic-link auth + Realtime + Storage (avatars) + RLS
- **Zod** for input validation, **Biome** for lint/format, **Vercel Web Analytics**

Everything lives in one app and is mobile-first.

- Public: `/`, `/join`, `/leaderboard`, `/teams/[id]`
- Auth-gated: `/dashboard`, `/matches`, `/matches/[id]`, `/matches/flight/[id]`, `/profile`
- Admin-gated: `/admin`

## Tournament rules (encoded in the schema)

| Sport | Format | Points |
|-------|--------|--------|
| Padel | Round-robin | 1pt per match win |
| Tennis | Round-robin | 1pt per match win |
| Disc Golf | 1–2 rounds × flights of 2 teams (best disc) | Sum of strokes ranks teams; N → 1 points |
| Golf | 1–2 rounds × flights of 2 teams (best ball) | Sum of strokes ranks teams; N → 1 points |

## Sign-up flows

Two parallel paths feed into the same approval queue under `/admin → Påmeldinger`:

1. **Individual signup** (`/join` → "Meld deg på alene"): player fills out name/nickname/bio plus
   skill level per sport. Posted to `POST /api/signup`, validated with zod, written to
   `player_submissions` (status `pending`). On admin approval an auth user is created and a
   magic-link invite is sent. The player can then be placed on a team manually or via the
   automatic balancer.
2. **Team signup** (`/join` → "Meld på et helt lag"): two players submit themselves as a pair
   with a team name. Posted to `POST /api/team-signup`, written to `team_submissions`. On
   approval, both users are created/invited and added to a new `teams` row.

Admins approve / reject from `/admin`:
- `POST /api/player-submissions/[id]` — approve or reject a solo entry
- `POST /api/team-submissions/[id]` — approve or reject a paired entry

Both approval routes run server-side with the **secret key** (`SUPABASE_SECRET_KEY`) to create
auth users and send the invite mail.

## Score-submission flow

1. One team submits the score (match) or strokes (flight).
2. The opposing team sees a pending result on `/dashboard` and `/matches`.
3. They tap **Confirm** (or **Dispute**, which flags it for an admin).
4. Confirmed scores immediately update `team_totals` → `/leaderboard` realtime broadcasts the
   change.

The RPCs `submit_match_result`, `confirm_match_result`, `submit_flight_result`,
`confirm_flight_result` (and their dispute counterparts) enforce who-can-submit-what via RLS.

## Project layout

```
src/
  app/
    (marketing)/              — landing page + /join (public)
      join/                   — chooser + solo form + team form
    auth/                     — sign-in (password + magic link), callback, sign-out, error
    leaderboard/              — public leaderboard with realtime
    teams/[id]/               — team detail page + name & avatar controls (public)
    dashboard/                — pending confirmations + upcoming matches
    matches/                  — list, match detail (padel/tennis), flight detail (disc golf/golf)
    profile/                  — edit name, nickname, bio, avatar, per-sport skill
    admin/                    — admin console (Oversikt, Påmeldinger, Lag, Spillere, Oppsett,
                                Resultater, Aktivitetslogg, Administratorer) + activity log panel
    api/
      signup/                 — POST: individual player submission
      team-signup/            — POST: paired team submission
      player-submissions/[id] — POST: admin approve/reject solo submission (server-only key)
      team-submissions/[id]   — POST: admin approve/reject team submission (server-only key)
  components/                 — app-shell, avatar + uploader, match-card, match-headline,
                                team-points-breakdown, auth-hash-error
  lib/
    supabase/                 — server, browser, middleware clients
    auth.ts                   — getSessionUser / requireAdmin
    sports.ts                 — sport metadata (labels, colors, icons)
    team-balancer.ts          — auto pair unassigned players into balanced teams
    validation.ts             — zod schemas for /api/signup and /api/team-signup
    database.types.ts         — generated types (regenerate with `pnpm gen:types`)
supabase/
  config.toml                 — local stack config (ports, auth, storage, etc.)
  seed.sql                    — demo users, teams, matches, flights, a pending submission
  migrations/                 — 20260429120000_init.sql … 20260506000000_avatars.sql
scripts/
  conductor-setup.sh          — boot local Supabase + write .env.local from `supabase status`
```

## Running locally with the Supabase dev stack

Prereqs: Node 20+, **pnpm**, the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started),
and Docker (the CLI uses Docker to run Postgres + GoTrue + Studio + Inbucket).

### Quickstart

```bash
pnpm install
./scripts/conductor-setup.sh   # supabase start + write .env.local
pnpm db:reset                  # apply migrations + run seed.sql
pnpm dev                       # http://localhost:3000
```

Once up, the seed (`supabase/seed.sql`) gives you:

- 18 users with password **`password`** — sign in at `/auth/sign-in`. Notable accounts:
  - `admin@grandest-slam.no` — `super_admin`
  - `mod@grandest-slam.no` — `admin`
  - 16 players, e.g. `alice@grandest-slam.no`, `bob@grandest-slam.no`, …
- Three teams (Smashing Pumpkins, Tee Time Tigers, Disc Dynamos)
- A padel + tennis round-robin with one confirmed and one pending result
- Three flights with one confirmed golf result
- One pending player submission so `/admin → Påmeldinger` has work

Supabase service URLs (from `supabase/config.toml`):

| Service        | URL                              |
|----------------|----------------------------------|
| API            | `http://127.0.0.1:54321`         |
| Postgres       | `postgresql://…@127.0.0.1:54322` |
| Studio (UI)    | `http://127.0.0.1:54323`         |
| Inbucket (mail)| `http://127.0.0.1:54324`         |
| Analytics      | `http://127.0.0.1:54327`         |

Magic-link emails and invites sent locally are caught by **Inbucket** — open it and click the
link to complete sign-in.

### Manual variant (if you'd rather not use the setup script)

```bash
supabase start
supabase status -o env                 # copy NEXT_PUBLIC_SUPABASE_URL / publishable / secret
# paste into .env.local (see .env.example)
pnpm db:reset
pnpm dev
```

### Resetting & evolving the schema

- `pnpm db:reset` — drop + recreate the local DB, run every migration, run `seed.sql`.
- `pnpm db:diff` — diff your live Studio edits against migrations (for authoring new ones).
- `pnpm gen:types` — regenerate `src/lib/database.types.ts` from the local stack.

When you change schema, add a new file in `supabase/migrations/` (timestamped) rather than
editing the init migration.

## Setting up against a hosted Supabase project

### 1. Create a project

```bash
supabase login
supabase projects create grandest-slam
# or via the dashboard: https://supabase.com/dashboard/projects → New project
```

### 2. Push migrations

```bash
supabase link --project-ref <your-project-ref>
pnpm db:push
```

This creates `profiles`, `teams`, `team_members`, `player_experience`, `player_submissions`,
`team_submissions`, `matches`, `flights`, `tournament`, `activity_log`; the `team_totals` and
`team_sport_points` views; storage buckets for avatars; RLS policies; the submission /
confirmation / dispute RPCs; and a trigger that auto-creates a profile on signup and marks the
**first user** as `super_admin`.

### 3. Configure env

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

These are the new Supabase API keys (replacing the legacy anon / service_role JWTs). Find them
in your project dashboard under **Settings → API Keys**. The secret key is **server-only** and
used by the team / player approval routes to create auth users and send invites. Never expose it
to the browser.

### 4. Configure Supabase Auth

In the Supabase dashboard → **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000` (and your production URL)
- Redirect URLs: add `http://localhost:3000/auth/callback` and the production equivalent

### 5. Bootstrap a super_admin

The very first auth user created becomes `super_admin` automatically (handled by the
`handle_new_user` trigger): sign in via `/auth/sign-in` and you're set. From `/admin` you can
then promote others.

## Running the tournament — admin playbook

1. Players sign up via `/join` (solo or as a pair).
2. Open `/admin → Påmeldinger` and approve/reject each entry. Approval sends the invite email.
3. Place unassigned players into teams manually or use **Generer lag automatisk** (uses
   `lib/team-balancer.ts` to balance by experience).
4. From **Oversikt**, click **Generate round-robin** — creates every Padel and Tennis match
   between every pair of teams.
5. From **Oppsett**, add Disc Golf and Golf flights (which teams are paired together).
6. Click **Start tournament**.
7. As scores come in, the leaderboard updates in realtime. Disputes show up under **Resultater**.
8. **End tournament** when complete.

## Realtime

`matches`, `flights`, `teams`, `team_members` and `tournament` are added to the
`supabase_realtime` publication. The leaderboard, matches list and dashboard all subscribe to
postgres changes and re-fetch derived views.

## Avatars

Players and teams can upload avatars (`/profile` and `/teams/[id]`). The uploader crops, EXIF-
rotates, and re-encodes to WebP on the client before pushing to a Supabase Storage bucket;
public URLs are stored on `profiles.avatar_url` / `teams.avatar_url`.

## Deployment

Designed for Vercel. Push the repo, set the three env vars in the Vercel dashboard, deploy. Add
the production URL to Supabase Auth's allowed redirect list. `@vercel/analytics` is wired up via
the root layout.

## Useful scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Run the production build locally |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | Biome check (and write) |
| `pnpm db:reset` | Reset the local Supabase DB, replay migrations, run `seed.sql` |
| `pnpm db:diff` | Diff Studio edits against the migration history |
| `pnpm db:push` | Push migrations to the linked remote project |
| `pnpm gen:types` | Regenerate `src/lib/database.types.ts` from the local stack |
| `./scripts/conductor-setup.sh` | `supabase start` + write `.env.local` from `supabase status` |
