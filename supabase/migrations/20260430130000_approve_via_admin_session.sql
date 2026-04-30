-- =====================================================================
-- Make team approval work via the admin's own session — no service-role
-- DB writes required. We update handle_new_user() to also pick up the
-- bio from invite metadata, and we add explicit grants on
-- team_submissions for safety.
-- =====================================================================

-- Pull bio out of raw_user_meta_data (set by inviteUserByEmail) so the
-- profile gets fully populated at creation time.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
  full_name_val text;
  bio_val text;
begin
  select count(*) = 0 into is_first from profiles;
  full_name_val := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  bio_val := nullif(new.raw_user_meta_data->>'bio', '');
  insert into profiles (id, email, full_name, bio, role)
  values (
    new.id,
    new.email,
    full_name_val,
    bio_val,
    case when is_first then 'super_admin'::user_role else 'player'::user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Belt-and-braces: explicit privileges for the service_role used by the
-- auth admin API calls in the approve route.
grant all on team_submissions to service_role;
grant all on
  profiles,
  teams,
  team_members,
  player_experience,
  matches,
  flights,
  tournament
to service_role;
