-- =====================================================================
-- Move from team-based registration to individual player registration.
-- =====================================================================
-- * Drop team_submissions and its rejection RPC.
-- * Remove 'pro' from experience_level (any existing 'pro' rows → 'advanced').
-- * Add nickname to profiles.
-- * Create player_submissions: one row per player, anon-insertable.
-- * Update handle_new_user() to copy nickname through invite metadata.
-- =====================================================================

-- Drop team_submissions and related objects.
alter publication supabase_realtime drop table team_submissions;
drop function if exists reject_team_submission(uuid, text);
drop table if exists team_submissions;
drop type if exists team_review_status;

-- Drop 'pro' from experience_level by recreating the enum.
update player_experience set level = 'advanced'::experience_level where level = 'pro';
alter type experience_level rename to experience_level_old;
create type experience_level as enum ('beginner', 'intermediate', 'advanced');
alter table player_experience
  alter column level type experience_level using level::text::experience_level;
drop type experience_level_old;

-- Add nickname to profiles.
alter table profiles add column nickname text;

-- =====================================================================
-- player_submissions — public form writes here. Admin approves to
-- create the auth user / profile / experience rows; teams are formed
-- separately by the admin team-generator.
-- =====================================================================

create type player_review_status as enum ('pending', 'approved', 'rejected');

create table player_submissions (
  id uuid primary key default gen_random_uuid(),
  status player_review_status not null default 'pending',

  first_name text not null,
  last_name text not null,
  nickname text,
  email text not null,
  bio text,
  experience jsonb not null,

  rejection_reason text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_profile_id uuid references profiles(id) on delete set null,

  created_at timestamptz not null default now()
);

create index player_submissions_status_idx on player_submissions(status, created_at desc);
create unique index player_submissions_email_pending_idx
  on player_submissions(lower(email))
  where status = 'pending';

alter table player_submissions enable row level security;

create policy "anyone can submit a player"
  on player_submissions for insert with check (true);

create policy "admins read player submissions"
  on player_submissions for select using (is_admin(auth.uid()));

create policy "admins update player submissions"
  on player_submissions for update using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

create policy "admins delete player submissions"
  on player_submissions for delete using (is_admin(auth.uid()));

alter publication supabase_realtime add table player_submissions;

grant insert on player_submissions to anon, authenticated;
grant select, update, delete on player_submissions to authenticated;
grant all on player_submissions to service_role;

-- Pull nickname out of raw_user_meta_data alongside full_name and bio.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
  full_name_val text;
  nickname_val text;
  bio_val text;
begin
  select count(*) = 0 into is_first from profiles;
  full_name_val := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  nickname_val := nullif(new.raw_user_meta_data->>'nickname', '');
  bio_val := nullif(new.raw_user_meta_data->>'bio', '');
  insert into profiles (id, email, full_name, nickname, bio, role)
  values (
    new.id,
    new.email,
    full_name_val,
    nickname_val,
    bio_val,
    case when is_first then 'super_admin'::user_role else 'player'::user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Admin-only RPC to reject a pending player submission.
create or replace function reject_player_submission(p_submission_id uuid, p_reason text default null)
returns player_submissions language plpgsql security definer set search_path = public as $$
declare
  s player_submissions;
begin
  if not is_admin(auth.uid()) then raise exception 'admin only'; end if;
  update player_submissions set
    status = 'rejected',
    rejection_reason = p_reason,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = p_submission_id and status = 'pending'
  returning * into s;
  if s.id is null then raise exception 'submission not found or already reviewed'; end if;
  return s;
end;
$$;

grant execute on function reject_player_submission(uuid, text) to authenticated;
