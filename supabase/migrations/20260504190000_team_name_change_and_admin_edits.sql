-- =====================================================================
-- Team-name change requests + admin nickname edits.
-- =====================================================================
-- A player can propose a new team name; the rename only takes effect
-- once the other teammate approves. Admins keep their direct rename
-- ability (existing RLS policy "teams writable by admins") and can also
-- update player nicknames via a new RPC.
-- =====================================================================

alter table teams
  add column if not exists pending_name text,
  add column if not exists pending_name_requested_by uuid
    references profiles(id) on delete set null,
  add column if not exists pending_name_requested_at timestamptz;

-- Pending name follows the same name-uniqueness rule as the live name,
-- so two teams can't reserve the same future name in parallel.
create unique index if not exists teams_pending_name_unique
  on teams (lower(pending_name))
  where pending_name is not null;

-- =====================================================================
-- request_team_name_change — caller must be on the team. Replaces any
-- existing pending request from the same caller.
-- =====================================================================

create or replace function request_team_name_change(
  p_team_id uuid,
  p_new_name text
) returns teams language plpgsql security definer set search_path = public as $$
declare
  t teams;
  uid uuid := auth.uid();
  trimmed text := btrim(coalesce(p_new_name, ''));
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not is_team_member(uid, p_team_id) then
    raise exception 'not a team member';
  end if;
  if length(trimmed) < 2 then raise exception 'name too short'; end if;
  if length(trimmed) > 60 then raise exception 'name too long'; end if;

  select * into t from teams where id = p_team_id;
  if t.id is null then raise exception 'team not found'; end if;
  if lower(trimmed) = lower(t.name) then
    raise exception 'new name is the same as the current one';
  end if;
  if exists (
    select 1 from teams
    where id <> p_team_id and lower(name) = lower(trimmed)
  ) then
    raise exception 'a team already has that name';
  end if;

  update teams set
    pending_name = trimmed,
    pending_name_requested_by = uid,
    pending_name_requested_at = now()
  where id = p_team_id
  returning * into t;
  return t;
end;
$$;

-- =====================================================================
-- approve_team_name_change — caller must be a team member who is NOT
-- the requester. Admins can also approve to unblock stuck teams.
-- =====================================================================

create or replace function approve_team_name_change(p_team_id uuid)
returns teams language plpgsql security definer set search_path = public as $$
declare
  t teams;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into t from teams where id = p_team_id;
  if t.id is null then raise exception 'team not found'; end if;
  if t.pending_name is null then
    raise exception 'no pending name change';
  end if;
  if not is_admin(uid) then
    if not is_team_member(uid, p_team_id) then
      raise exception 'not a team member';
    end if;
    if t.pending_name_requested_by = uid then
      raise exception 'requester cannot approve their own change';
    end if;
  end if;
  if exists (
    select 1 from teams
    where id <> p_team_id and lower(name) = lower(t.pending_name)
  ) then
    -- Someone else snagged the name in the meantime. Drop the request.
    update teams set
      pending_name = null,
      pending_name_requested_by = null,
      pending_name_requested_at = null
    where id = p_team_id;
    raise exception 'a team already has that name';
  end if;

  update teams set
    name = pending_name,
    pending_name = null,
    pending_name_requested_by = null,
    pending_name_requested_at = null
  where id = p_team_id
  returning * into t;
  return t;
end;
$$;

-- =====================================================================
-- cancel_team_name_change — either teammate (or an admin) can cancel.
-- =====================================================================

create or replace function cancel_team_name_change(p_team_id uuid)
returns teams language plpgsql security definer set search_path = public as $$
declare
  t teams;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not (is_admin(uid) or is_team_member(uid, p_team_id)) then
    raise exception 'not a team member';
  end if;
  update teams set
    pending_name = null,
    pending_name_requested_by = null,
    pending_name_requested_at = null
  where id = p_team_id
  returning * into t;
  if t.id is null then raise exception 'team not found'; end if;
  return t;
end;
$$;

-- =====================================================================
-- admin_update_player_nickname — admins can rewrite a player's
-- nickname. RLS otherwise restricts profiles updates to the owner.
-- =====================================================================

create or replace function admin_update_player_nickname(
  p_profile_id uuid,
  p_nickname text
) returns profiles language plpgsql security definer set search_path = public as $$
declare
  p profiles;
  trimmed text := nullif(btrim(coalesce(p_nickname, '')), '');
begin
  if not is_admin(auth.uid()) then raise exception 'admin only'; end if;
  if trimmed is not null and length(trimmed) > 40 then
    raise exception 'nickname too long';
  end if;
  update profiles set nickname = trimmed where id = p_profile_id returning * into p;
  if p.id is null then raise exception 'profile not found'; end if;
  return p;
end;
$$;

grant execute on function request_team_name_change(uuid, text) to authenticated;
grant execute on function approve_team_name_change(uuid) to authenticated;
grant execute on function cancel_team_name_change(uuid) to authenticated;
grant execute on function admin_update_player_nickname(uuid, text) to authenticated;
