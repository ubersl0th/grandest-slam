-- =====================================================================
-- Team signup: a parallel registration flow alongside individual sign-up.
-- Two friends fill in everything for both players plus a team name; an
-- admin approves; on approval we create the team, both profiles, save
-- experience, and send magic-link invites.
-- =====================================================================

create type team_review_status as enum ('pending', 'approved', 'rejected');

create table team_submissions (
  id uuid primary key default gen_random_uuid(),
  status team_review_status not null default 'pending',

  team_name text not null,
  team_bio text,

  player_1_first_name text not null,
  player_1_last_name text not null,
  player_1_nickname text,
  player_1_email text not null,
  player_1_bio text,
  player_1_experience jsonb not null,

  player_2_first_name text not null,
  player_2_last_name text not null,
  player_2_nickname text,
  player_2_email text not null,
  player_2_bio text,
  player_2_experience jsonb not null,

  rejection_reason text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_team_id uuid references teams(id) on delete set null,

  created_at timestamptz not null default now(),

  constraint team_submissions_different_emails
    check (lower(player_1_email) <> lower(player_2_email))
);

create index team_submissions_status_idx on team_submissions(status, created_at desc);
create unique index team_submissions_team_name_pending_idx
  on team_submissions(lower(team_name))
  where status = 'pending';

alter table team_submissions enable row level security;

create policy "anyone can submit a team"
  on team_submissions for insert with check (true);

create policy "admins read team submissions"
  on team_submissions for select using (is_admin(auth.uid()));

create policy "admins update team submissions"
  on team_submissions for update using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

create policy "admins delete team submissions"
  on team_submissions for delete using (is_admin(auth.uid()));

alter publication supabase_realtime add table team_submissions;

grant insert on team_submissions to anon, authenticated;
grant select, update, delete on team_submissions to authenticated;
grant all on team_submissions to service_role;

-- Admin-only RPC to reject a pending team submission.
create or replace function reject_team_submission(
  p_submission_id uuid,
  p_reason text default null
) returns team_submissions language plpgsql security definer set search_path = public as $$
declare
  s team_submissions;
begin
  if not is_admin(auth.uid()) then raise exception 'admin only'; end if;
  update team_submissions set
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

grant execute on function reject_team_submission(uuid, text) to authenticated;
