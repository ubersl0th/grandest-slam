-- =====================================================================
-- The Grandest Slam — initial schema
-- =====================================================================
-- A four-sport tournament for teams of two: Padel, Tennis, Disc Golf, Golf.
-- Padel/Tennis are round-robin, 1pt per match win.
-- Disc Golf/Golf are stroke-play flights of two teams (best ball); after
-- all rounds, teams are ranked by total strokes and awarded N..1 points.
-- =====================================================================

create extension if not exists "pgcrypto";

-- =====================================================================
-- Enums
-- =====================================================================

create type sport as enum ('padel', 'tennis', 'disc_golf', 'golf');
create type experience_level as enum ('beginner', 'intermediate', 'advanced', 'pro');
create type user_role as enum ('player', 'admin', 'super_admin');
create type submission_status as enum ('pending', 'confirmed', 'disputed');
create type tournament_status as enum ('not_started', 'active', 'completed');

-- =====================================================================
-- profiles — one row per auth user
-- =====================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  bio text,
  role user_role not null default 'player',
  created_at timestamptz not null default now()
);

create index profiles_role_idx on profiles(role);

-- =====================================================================
-- tournament — single-row config table
-- =====================================================================

create table tournament (
  id int primary key default 1,
  name text not null default 'The Grandest Slam',
  status tournament_status not null default 'not_started',
  golf_rounds int not null default 1 check (golf_rounds in (1, 2)),
  disc_golf_rounds int not null default 1 check (disc_golf_rounds in (1, 2)),
  started_at timestamptz,
  ended_at timestamptz,
  constraint single_row check (id = 1)
);

insert into tournament (id) values (1);

-- =====================================================================
-- teams
-- =====================================================================

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  bio text,
  created_at timestamptz not null default now()
);

create index teams_name_idx on teams(lower(name));

-- =====================================================================
-- team_members — exactly two players per team (enforced by trigger below)
-- =====================================================================

create table team_members (
  team_id uuid not null references teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (team_id, profile_id)
);

create index team_members_profile_idx on team_members(profile_id);

-- A profile can only belong to one team.
create unique index team_members_one_team_per_profile on team_members(profile_id);

-- =====================================================================
-- player_experience — experience level per (player, sport)
-- =====================================================================

create table player_experience (
  profile_id uuid not null references profiles(id) on delete cascade,
  sport sport not null,
  level experience_level not null,
  primary key (profile_id, sport)
);

-- =====================================================================
-- matches — Padel & Tennis round-robin matches
-- =====================================================================

create table matches (
  id uuid primary key default gen_random_uuid(),
  sport sport not null check (sport in ('padel', 'tennis')),
  team_a uuid not null references teams(id) on delete cascade,
  team_b uuid not null references teams(id) on delete cascade,
  -- Reported fields (null until a result is submitted)
  winner_team_id uuid references teams(id) on delete cascade,
  score_a int,
  score_b int,
  notes text,
  -- Submission tracking
  submitted_by uuid references profiles(id) on delete set null,
  submitted_at timestamptz,
  confirmed_by uuid references profiles(id) on delete set null,
  confirmed_at timestamptz,
  status submission_status,
  created_at timestamptz not null default now(),
  constraint different_teams check (team_a <> team_b),
  constraint winner_in_match check (
    winner_team_id is null
    or winner_team_id = team_a
    or winner_team_id = team_b
  )
);

create unique index matches_unique_pair on matches (
  sport,
  least(team_a::text, team_b::text),
  greatest(team_a::text, team_b::text)
);

create index matches_sport_status_idx on matches(sport, status);
create index matches_team_a_idx on matches(team_a);
create index matches_team_b_idx on matches(team_b);

-- =====================================================================
-- flights — Disc Golf / Golf rounds; 2 teams per flight, 1 stroke score per team
-- =====================================================================

create table flights (
  id uuid primary key default gen_random_uuid(),
  sport sport not null check (sport in ('disc_golf', 'golf')),
  round_number int not null check (round_number between 1 and 2),
  scheduled_at timestamptz,
  team_1 uuid not null references teams(id) on delete cascade,
  team_2 uuid not null references teams(id) on delete cascade,
  strokes_1 int,
  strokes_2 int,
  notes text,
  submitted_by uuid references profiles(id) on delete set null,
  submitted_at timestamptz,
  confirmed_by uuid references profiles(id) on delete set null,
  confirmed_at timestamptz,
  status submission_status,
  created_at timestamptz not null default now(),
  constraint different_flight_teams check (team_1 <> team_2)
);

create index flights_sport_status_idx on flights(sport, status);
create index flights_team_1_idx on flights(team_1);
create index flights_team_2_idx on flights(team_2);

-- =====================================================================
-- Triggers
-- =====================================================================

-- Cap teams at two members.
create or replace function enforce_team_size()
returns trigger language plpgsql as $$
declare
  member_count int;
begin
  select count(*) into member_count from team_members where team_id = new.team_id;
  if member_count >= 2 then
    raise exception 'team % already has two members', new.team_id;
  end if;
  return new;
end;
$$;

create trigger team_members_size_check
before insert on team_members
for each row execute function enforce_team_size();

-- Auto-create a profile row when a new auth user signs up.
-- The first user matching SUPER_ADMIN_EMAIL becomes super_admin.
-- (This relies on the SUPER_ADMIN_EMAIL value being passed in raw_user_meta_data.super_admin_email
-- by the signup flow — see app code. As a fallback we mark the very first profile as super_admin.)
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
  full_name_val text;
begin
  select count(*) = 0 into is_first from profiles;
  full_name_val := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    full_name_val,
    case when is_first then 'super_admin'::user_role else 'player'::user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- =====================================================================
-- Helper functions for RLS / policies
-- =====================================================================

create or replace function is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = uid and role in ('admin', 'super_admin')
  );
$$;

create or replace function is_super_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = uid and role = 'super_admin'
  );
$$;

create or replace function is_team_member(uid uuid, tid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members
    where profile_id = uid and team_id = tid
  );
$$;

-- =====================================================================
-- Leaderboard view — total points per team across all sports
-- =====================================================================

-- Points per team per sport.
create or replace view team_sport_points as
-- Padel/Tennis: 1pt per confirmed match win
select
  t.id as team_id,
  m.sport::sport as sport,
  count(*)::int as points
from teams t
join matches m on (m.team_a = t.id or m.team_b = t.id)
where m.status = 'confirmed' and m.winner_team_id = t.id
group by t.id, m.sport

union all

-- Disc Golf/Golf: rank by sum of strokes (lower = better), award (N - rank + 1) points
select
  ranked.team_id,
  ranked.sport,
  greatest(0, total_teams - ranked.rk + 1)::int as points
from (
  select
    s.team_id,
    s.sport,
    s.total_strokes,
    rank() over (partition by s.sport order by s.total_strokes asc) as rk,
    count(*) over (partition by s.sport) as total_teams
  from (
    select
      t.id as team_id,
      f.sport::sport as sport,
      sum(case when f.team_1 = t.id then f.strokes_1 else f.strokes_2 end)::int as total_strokes,
      count(*) as flight_count
    from teams t
    join flights f on (f.team_1 = t.id or f.team_2 = t.id)
    where f.status = 'confirmed'
      and f.strokes_1 is not null
      and f.strokes_2 is not null
    group by t.id, f.sport
  ) s
) ranked;

-- Total points per team across all sports.
create or replace view team_totals as
select
  t.id as team_id,
  t.name as team_name,
  coalesce(sum(case when tsp.sport = 'padel' then tsp.points end), 0)::int as padel_points,
  coalesce(sum(case when tsp.sport = 'tennis' then tsp.points end), 0)::int as tennis_points,
  coalesce(sum(case when tsp.sport = 'disc_golf' then tsp.points end), 0)::int as disc_golf_points,
  coalesce(sum(case when tsp.sport = 'golf' then tsp.points end), 0)::int as golf_points,
  coalesce(sum(tsp.points), 0)::int as total_points
from teams t
left join team_sport_points tsp on tsp.team_id = t.id
group by t.id, t.name;

-- =====================================================================
-- Row-level security
-- =====================================================================

alter table profiles enable row level security;
alter table tournament enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table player_experience enable row level security;
alter table matches enable row level security;
alter table flights enable row level security;

-- profiles: anyone can read, owner can update non-role fields, admins manage roles via RPC.
create policy "profiles readable by anyone"
  on profiles for select using (true);

create policy "profiles updatable by owner"
  on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from profiles where id = auth.uid()));

create policy "profiles role updatable by super_admin"
  on profiles for update using (is_super_admin(auth.uid()))
  with check (is_super_admin(auth.uid()));

-- tournament: readable by all; only admins can update.
create policy "tournament readable by anyone"
  on tournament for select using (true);

create policy "tournament writable by admins"
  on tournament for update using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- teams: readable by all; created via signup flow (service role) or admins.
create policy "teams readable by anyone"
  on teams for select using (true);

create policy "teams writable by admins"
  on teams for all using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- team_members: readable by all; written by service role / admins only.
create policy "team_members readable by anyone"
  on team_members for select using (true);

create policy "team_members writable by admins"
  on team_members for all using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- player_experience: readable by all; editable by the profile owner or admins.
create policy "player_experience readable by anyone"
  on player_experience for select using (true);

create policy "player_experience writable by self"
  on player_experience for all
  using (auth.uid() = profile_id or is_admin(auth.uid()))
  with check (auth.uid() = profile_id or is_admin(auth.uid()));

-- matches: readable by all; insert by admins (creating the round-robin schedule);
-- update (= submit/confirm) by team members of either team; admins can override.
create policy "matches readable by anyone"
  on matches for select using (true);

create policy "matches inserted by admins"
  on matches for insert with check (is_admin(auth.uid()));

create policy "matches updatable by participating team members or admins"
  on matches for update
  using (
    is_admin(auth.uid())
    or is_team_member(auth.uid(), team_a)
    or is_team_member(auth.uid(), team_b)
  )
  with check (
    is_admin(auth.uid())
    or is_team_member(auth.uid(), team_a)
    or is_team_member(auth.uid(), team_b)
  );

create policy "matches deletable by admins"
  on matches for delete using (is_admin(auth.uid()));

-- flights: same model as matches.
create policy "flights readable by anyone"
  on flights for select using (true);

create policy "flights inserted by admins"
  on flights for insert with check (is_admin(auth.uid()));

create policy "flights updatable by participating team members or admins"
  on flights for update
  using (
    is_admin(auth.uid())
    or is_team_member(auth.uid(), team_1)
    or is_team_member(auth.uid(), team_2)
  )
  with check (
    is_admin(auth.uid())
    or is_team_member(auth.uid(), team_1)
    or is_team_member(auth.uid(), team_2)
  );

create policy "flights deletable by admins"
  on flights for delete using (is_admin(auth.uid()));

-- =====================================================================
-- Realtime — publish tables that drive live UI
-- =====================================================================

alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table flights;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table team_members;
alter publication supabase_realtime add table tournament;

-- =====================================================================
-- RPCs
-- =====================================================================

-- Submit a Padel/Tennis match result. Caller must be on team_a or team_b.
create or replace function submit_match_result(
  p_match_id uuid,
  p_score_a int,
  p_score_b int,
  p_notes text default null
) returns matches language plpgsql security definer set search_path = public as $$
declare
  m matches;
  uid uuid := auth.uid();
begin
  select * into m from matches where id = p_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  if not (is_team_member(uid, m.team_a) or is_team_member(uid, m.team_b) or is_admin(uid)) then
    raise exception 'not a participant';
  end if;
  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 then
    raise exception 'invalid scores';
  end if;
  if p_score_a = p_score_b then
    raise exception 'matches cannot end in a tie';
  end if;
  update matches set
    score_a = p_score_a,
    score_b = p_score_b,
    notes = p_notes,
    winner_team_id = case when p_score_a > p_score_b then team_a else team_b end,
    submitted_by = uid,
    submitted_at = now(),
    confirmed_by = null,
    confirmed_at = null,
    status = 'pending'
  where id = p_match_id
  returning * into m;
  return m;
end;
$$;

-- Confirm a Padel/Tennis match. Caller must be on the OPPOSITE team from submitter
-- (or an admin can override).
create or replace function confirm_match_result(p_match_id uuid)
returns matches language plpgsql security definer set search_path = public as $$
declare
  m matches;
  uid uuid := auth.uid();
  submitter_team uuid;
begin
  select * into m from matches where id = p_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  if m.status <> 'pending' then raise exception 'match is not pending'; end if;
  if is_admin(uid) then
    -- admins can confirm anything
    null;
  else
    select team_id into submitter_team from team_members
      where profile_id = m.submitted_by
      and team_id in (m.team_a, m.team_b)
      limit 1;
    if not is_team_member(uid, case when submitter_team = m.team_a then m.team_b else m.team_a end) then
      raise exception 'only the opposing team can confirm';
    end if;
  end if;
  update matches set
    status = 'confirmed',
    confirmed_by = uid,
    confirmed_at = now()
  where id = p_match_id
  returning * into m;
  return m;
end;
$$;

create or replace function dispute_match_result(p_match_id uuid, p_reason text default null)
returns matches language plpgsql security definer set search_path = public as $$
declare
  m matches;
  uid uuid := auth.uid();
begin
  select * into m from matches where id = p_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  if not (is_team_member(uid, m.team_a) or is_team_member(uid, m.team_b) or is_admin(uid)) then
    raise exception 'not a participant';
  end if;
  update matches set
    status = 'disputed',
    notes = coalesce(p_reason, notes)
  where id = p_match_id
  returning * into m;
  return m;
end;
$$;

-- Submit a flight result. Caller must be on team_1 or team_2.
create or replace function submit_flight_result(
  p_flight_id uuid,
  p_strokes_1 int,
  p_strokes_2 int,
  p_notes text default null
) returns flights language plpgsql security definer set search_path = public as $$
declare
  f flights;
  uid uuid := auth.uid();
begin
  select * into f from flights where id = p_flight_id;
  if f.id is null then raise exception 'flight not found'; end if;
  if not (is_team_member(uid, f.team_1) or is_team_member(uid, f.team_2) or is_admin(uid)) then
    raise exception 'not a participant';
  end if;
  if p_strokes_1 is null or p_strokes_2 is null or p_strokes_1 <= 0 or p_strokes_2 <= 0 then
    raise exception 'invalid strokes';
  end if;
  update flights set
    strokes_1 = p_strokes_1,
    strokes_2 = p_strokes_2,
    notes = p_notes,
    submitted_by = uid,
    submitted_at = now(),
    confirmed_by = null,
    confirmed_at = null,
    status = 'pending'
  where id = p_flight_id
  returning * into f;
  return f;
end;
$$;

create or replace function confirm_flight_result(p_flight_id uuid)
returns flights language plpgsql security definer set search_path = public as $$
declare
  f flights;
  uid uuid := auth.uid();
  submitter_team uuid;
begin
  select * into f from flights where id = p_flight_id;
  if f.id is null then raise exception 'flight not found'; end if;
  if f.status <> 'pending' then raise exception 'flight is not pending'; end if;
  if is_admin(uid) then
    null;
  else
    select team_id into submitter_team from team_members
      where profile_id = f.submitted_by
      and team_id in (f.team_1, f.team_2)
      limit 1;
    if not is_team_member(uid, case when submitter_team = f.team_1 then f.team_2 else f.team_1 end) then
      raise exception 'only the opposing team can confirm';
    end if;
  end if;
  update flights set
    status = 'confirmed',
    confirmed_by = uid,
    confirmed_at = now()
  where id = p_flight_id
  returning * into f;
  return f;
end;
$$;

create or replace function dispute_flight_result(p_flight_id uuid, p_reason text default null)
returns flights language plpgsql security definer set search_path = public as $$
declare
  f flights;
  uid uuid := auth.uid();
begin
  select * into f from flights where id = p_flight_id;
  if f.id is null then raise exception 'flight not found'; end if;
  if not (is_team_member(uid, f.team_1) or is_team_member(uid, f.team_2) or is_admin(uid)) then
    raise exception 'not a participant';
  end if;
  update flights set
    status = 'disputed',
    notes = coalesce(p_reason, notes)
  where id = p_flight_id
  returning * into f;
  return f;
end;
$$;

-- Generate a round-robin schedule for Padel and Tennis based on current teams.
-- Idempotent: deletes any existing matches first. Admins only.
create or replace function generate_round_robin()
returns int language plpgsql security definer set search_path = public as $$
declare
  count_inserted int := 0;
  s sport;
begin
  if not is_admin(auth.uid()) then raise exception 'admin only'; end if;
  delete from matches;
  for s in select unnest(array['padel'::sport, 'tennis'::sport]) loop
    insert into matches (sport, team_a, team_b)
    select s, t1.id, t2.id
    from teams t1
    cross join teams t2
    where t1.id < t2.id;
  end loop;
  get diagnostics count_inserted = row_count;
  return count_inserted;
end;
$$;

-- Promote / demote admin roles. Super-admin only.
create or replace function set_user_role(p_profile_id uuid, p_role user_role)
returns profiles language plpgsql security definer set search_path = public as $$
declare
  p profiles;
begin
  if not is_super_admin(auth.uid()) then raise exception 'super admin only'; end if;
  if p_role = 'super_admin' then raise exception 'cannot promote to super_admin'; end if;
  update profiles set role = p_role where id = p_profile_id returning * into p;
  return p;
end;
$$;

-- Start / end the tournament. Admins only.
create or replace function start_tournament()
returns tournament language plpgsql security definer set search_path = public as $$
declare t tournament;
begin
  if not is_admin(auth.uid()) then raise exception 'admin only'; end if;
  update tournament set status = 'active', started_at = now(), ended_at = null
    where id = 1 returning * into t;
  return t;
end;
$$;

create or replace function end_tournament()
returns tournament language plpgsql security definer set search_path = public as $$
declare t tournament;
begin
  if not is_admin(auth.uid()) then raise exception 'admin only'; end if;
  update tournament set status = 'completed', ended_at = now()
    where id = 1 returning * into t;
  return t;
end;
$$;

grant execute on function submit_match_result(uuid, int, int, text) to authenticated;
grant execute on function confirm_match_result(uuid) to authenticated;
grant execute on function dispute_match_result(uuid, text) to authenticated;
grant execute on function submit_flight_result(uuid, int, int, text) to authenticated;
grant execute on function confirm_flight_result(uuid) to authenticated;
grant execute on function dispute_flight_result(uuid, text) to authenticated;
grant execute on function generate_round_robin() to authenticated;
grant execute on function set_user_role(uuid, user_role) to authenticated;
grant execute on function start_tournament() to authenticated;
grant execute on function end_tournament() to authenticated;

grant select on team_sport_points to anon, authenticated;
grant select on team_totals to anon, authenticated;
