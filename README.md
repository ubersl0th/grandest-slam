# The Grandest Slam

A four-sport summer tournament app — Padel, Tennis, Disc Golf and Golf, played in teams of two.
One Next.js app, Supabase for everything backend (Postgres, Auth, Realtime, RLS).

## Stack

- **Next.js 15** + React 19 (App Router, server components, middleware-driven auth)
- **Tailwind CSS v4** with a hand-rolled retro / sun-faded summer palette
- **Supabase**: Postgres + magic-link auth + Realtime subscriptions + RLS

Everything lives in one app and is mobile-first. Public pages: `/`, `/join`, `/leaderboard`,
`/teams/[id]`. Auth-gated: `/dashboard`, `/matches`, `/admin`.

## Tournament rules (encoded in the schema)

| Sport | Format | Points |
|-------|--------|--------|
| Padel | Round-robin | 1pt per match win |
| Tennis | Round-robin | 1pt per match win |
| Disc Golf | 1–2 rounds × flights of 2 teams (best disc) | Sum of strokes ranks teams; N → 1 points |
| Golf | 1–2 rounds × flights of 2 teams (best ball) | Sum of strokes ranks teams; N → 1 points |

## Score-submission flow

1. One team submits the score (or flight strokes).
2. The opposing team sees a notification on `/dashboard` and `/matches`.
3. They tap **Confirm** (or **Dispute**, which flags it for an admin).
4. Confirmed scores immediately update `team_totals` → `/leaderboard` realtime broadcasts the change.

## Setting up

### 1. Create a Supabase project

```bash
# In a browser: https://supabase.com/dashboard/projects → New project
# Or via CLI:
supabase login
supabase projects create grandest-slam
```

### 2. Push the migration

The full schema lives in `supabase/migrations/20260429120000_init.sql`. After linking your project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

This creates: `profiles`, `teams`, `team_members`, `player_experience`, `matches`, `flights`,
`tournament`; views `team_totals` and `team_sport_points`; RLS policies; RPCs (`submit_match_result`,
`confirm_match_result`, `submit_flight_result`, …); a trigger that auto-creates a profile on signup
and marks the **first user** as `super_admin`.

### 3. Configure env

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

These are the new Supabase API keys (replacing the legacy anon / service_role JWTs). Find them in
your project dashboard under **Settings → API Keys**. The secret key is **server-only** and used by
the team-approval route to send magic-link invites. Never expose it to the browser.

### 4. Configure Supabase Auth

In the Supabase dashboard → **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000` (and your production URL)
- Redirect URLs: add `http://localhost:3000/auth/callback` and the production equivalent

### 5. Run

```bash
pnpm install
pnpm dev
```

### 6. Bootstrap yourself as super_admin

The very first auth user created becomes `super_admin` automatically (handled by the
`handle_new_user` trigger). The simplest path:

1. Visit `/auth/sign-in` and request a magic link with **your** email.
2. Click the link → you're now `super_admin`.
3. Visit `/admin` to manage teams and admin roles.

Alternatively, sign up a team via `/join` first; the very first user created (whichever email is
processed first by Supabase) gets the role.

## Running the tournament — admin playbook

1. Wait for teams to sign up via `/join`.
2. Open `/admin` → **Overview**.
3. Click **Generate round-robin** — creates every Padel and Tennis match between every pair of teams.
4. Open **Schedule** → add Disc Golf and Golf flights (which teams are paired together).
5. Click **Start tournament** when you're ready.
6. As scores come in, watch the leaderboard. Disputes show up in the **Results** tab.
7. **End tournament** when complete.

## Realtime

`matches`, `flights`, `teams`, `team_members` and `tournament` are added to the
`supabase_realtime` publication. The leaderboard, matches list and dashboard all subscribe to
postgres changes and re-fetch derived views.

## Project layout

```
src/
  app/
    (marketing)/        — landing page + /join (public)
    auth/               — magic-link sign-in/callback/sign-out
    leaderboard/        — public leaderboard with realtime
    teams/[id]/         — team detail (public)
    dashboard/          — player home: pending confirmations + upcoming matches
    matches/            — match list + /[id] (Padel/Tennis) + /flight/[id] (DG/Golf)
    admin/              — admin console
    api/signup/         — creates team + invites both players
  components/           — Logo, AppShell
  lib/
    supabase/           — server, browser, middleware clients
    auth.ts             — getSessionUser / requireAdmin
    sports.ts           — sport metadata
    validation.ts       — zod schemas for /api/signup
    database.types.ts   — hand-written types (regenerate with `pnpm gen:types`)
supabase/
  migrations/
    20260429120000_init.sql
```

## Deployment

Designed for Vercel. Push the repo, set the three env vars in the Vercel dashboard, deploy. Add
the production URL to Supabase Auth's allowed redirect list.

## Useful scripts

- `pnpm dev` — dev server
- `pnpm build` — production build
- `pnpm typecheck` — no-emit TS check
- `pnpm gen:types` — regenerate `database.types.ts` from local supabase (requires `supabase start` and Docker)
- `pnpm db:push` — push migration to linked Supabase project
