-- =====================================================================
-- Avatars: profile + team images, plus a Supabase Storage bucket.
-- =====================================================================
-- - Players can edit their avatar directly from the profile page.
-- - Teams use a suggest/approve flow that mirrors team-name changes:
--   one teammate uploads a candidate image, the other accepts.
-- - The signup flows can stash an avatar in submissions so it can be
--   carried over when an admin approves the registration.
-- =====================================================================

alter table profiles
  add column if not exists avatar_url text;

alter table teams
  add column if not exists avatar_url text,
  add column if not exists pending_avatar_url text,
  add column if not exists pending_avatar_requested_by uuid
    references profiles(id) on delete set null,
  add column if not exists pending_avatar_requested_at timestamptz;

alter table player_submissions
  add column if not exists avatar_url text;

alter table team_submissions
  add column if not exists team_avatar_url text,
  add column if not exists player_1_avatar_url text,
  add column if not exists player_2_avatar_url text;

-- =====================================================================
-- Storage bucket for avatars (public, image/webp only, 2MiB cap).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,
  array['image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =====================================================================
-- Storage RLS policies
-- =====================================================================
-- Layout in the bucket:
--   profiles/{user_id}/{nonce}.webp     — owned by that auth user
--   teams/{team_id}/{nonce}.webp        — writable by any team_member
--   submissions/{nonce}.webp            — open for anonymous signup uploads

drop policy if exists "avatars are publicly readable" on storage.objects;
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars: anonymous submission uploads" on storage.objects;
create policy "avatars: anonymous submission uploads"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'submissions'
  );

drop policy if exists "avatars: profile owner manages own folder" on storage.objects;
create policy "avatars: profile owner manages own folder"
  on storage.objects for all
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'profiles'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'profiles'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "avatars: team members manage their team folder" on storage.objects;
create policy "avatars: team members manage their team folder"
  on storage.objects for all
  using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'teams'
    and exists (
      select 1 from public.team_members
      where profile_id = auth.uid()
        and team_id::text = (storage.foldername(name))[2]
    )
  )
  with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = 'teams'
    and exists (
      select 1 from public.team_members
      where profile_id = auth.uid()
        and team_id::text = (storage.foldername(name))[2]
    )
  );

drop policy if exists "avatars: admins manage all" on storage.objects;
create policy "avatars: admins manage all"
  on storage.objects for all
  using (bucket_id = 'avatars' and public.is_admin(auth.uid()))
  with check (bucket_id = 'avatars' and public.is_admin(auth.uid()));

-- =====================================================================
-- Profile avatar: trivial owner-only update is already covered by the
-- existing RLS on profiles. No new RPC needed.
-- =====================================================================

-- =====================================================================
-- Team avatar suggest / approve / cancel — mirrors the team-name flow.
-- =====================================================================

create or replace function request_team_avatar_change(
  p_team_id uuid,
  p_avatar_url text
) returns teams language plpgsql security definer set search_path = public as $$
declare
  t teams;
  uid uuid := auth.uid();
  trimmed text := nullif(btrim(coalesce(p_avatar_url, '')), '');
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not is_team_member(uid, p_team_id) then
    raise exception 'not a team member';
  end if;
  if trimmed is null then raise exception 'avatar url required'; end if;
  if length(trimmed) > 512 then raise exception 'avatar url too long'; end if;

  update teams set
    pending_avatar_url = trimmed,
    pending_avatar_requested_by = uid,
    pending_avatar_requested_at = now()
  where id = p_team_id
  returning * into t;
  if t.id is null then raise exception 'team not found'; end if;
  return t;
end;
$$;

create or replace function approve_team_avatar_change(p_team_id uuid)
returns teams language plpgsql security definer set search_path = public as $$
declare
  t teams;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into t from teams where id = p_team_id;
  if t.id is null then raise exception 'team not found'; end if;
  if t.pending_avatar_url is null then
    raise exception 'no pending avatar change';
  end if;
  if not is_admin(uid) then
    if not is_team_member(uid, p_team_id) then
      raise exception 'not a team member';
    end if;
    if t.pending_avatar_requested_by = uid then
      raise exception 'requester cannot approve their own change';
    end if;
  end if;
  update teams set
    avatar_url = pending_avatar_url,
    pending_avatar_url = null,
    pending_avatar_requested_by = null,
    pending_avatar_requested_at = null
  where id = p_team_id
  returning * into t;
  return t;
end;
$$;

create or replace function cancel_team_avatar_change(p_team_id uuid)
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
    pending_avatar_url = null,
    pending_avatar_requested_by = null,
    pending_avatar_requested_at = null
  where id = p_team_id
  returning * into t;
  if t.id is null then raise exception 'team not found'; end if;
  return t;
end;
$$;

grant execute on function request_team_avatar_change(uuid, text) to authenticated;
grant execute on function approve_team_avatar_change(uuid) to authenticated;
grant execute on function cancel_team_avatar_change(uuid) to authenticated;

-- =====================================================================
-- Surface team.avatar_url through the leaderboard view so the UI can
-- show team avatars without an extra join on the client.
-- =====================================================================

create or replace view team_totals as
select
  t.id as team_id,
  t.name as team_name,
  coalesce(sum(case when tsp.sport = 'padel' then tsp.points end), 0)::int as padel_points,
  coalesce(sum(case when tsp.sport = 'tennis' then tsp.points end), 0)::int as tennis_points,
  coalesce(sum(case when tsp.sport = 'disc_golf' then tsp.points end), 0)::int as disc_golf_points,
  coalesce(sum(case when tsp.sport = 'golf' then tsp.points end), 0)::int as golf_points,
  coalesce(sum(tsp.points), 0)::int as total_points,
  t.avatar_url as team_avatar_url
from teams t
left join team_sport_points tsp on tsp.team_id = t.id
group by t.id, t.name, t.avatar_url;

grant select on team_totals to anon, authenticated;
