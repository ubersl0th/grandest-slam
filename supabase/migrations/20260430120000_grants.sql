-- =====================================================================
-- Grants
-- =====================================================================
-- RLS gates *which rows* a role can touch, but it doesn't substitute for
-- table-level privileges. Without these GRANTs, PostgREST returns
-- "permission denied for table X" before RLS is even consulted.
-- =====================================================================

-- Anyone can submit a team for review (the public /join form).
grant insert on team_submissions to anon, authenticated;
-- Admins read/update/delete via RLS — granted to authenticated.
grant select, update, delete on team_submissions to authenticated;

-- Public reads on the rest of the schema (RLS already restricts further).
grant select on
  profiles,
  teams,
  team_members,
  player_experience,
  matches,
  flights,
  tournament
to anon, authenticated;

-- Authenticated mutations are still policy-gated by RLS — admins on most
-- tables, team members on their own match/flight rows, profile owner on
-- their own profile/experience rows.
grant insert, update, delete on
  profiles,
  teams,
  team_members,
  player_experience,
  matches,
  flights
to authenticated;

grant update on tournament to authenticated;
