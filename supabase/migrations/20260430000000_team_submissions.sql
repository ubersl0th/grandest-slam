-- =====================================================================
-- Team submissions: public form writes here. Admin approves → team is created
-- and players get their magic links.
-- =====================================================================

create type team_review_status as enum ('pending', 'approved', 'rejected');

create table team_submissions (
  id uuid primary key default gen_random_uuid(),
  status team_review_status not null default 'pending',

  team_name text not null,
  team_bio text,

  player_1_name text not null,
  player_1_email text not null,
  player_1_bio text,
  player_1_experience jsonb not null,

  player_2_name text not null,
  player_2_email text not null,
  player_2_bio text,
  player_2_experience jsonb not null,

  rejection_reason text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  approved_team_id uuid references teams(id) on delete set null,

  created_at timestamptz not null default now(),

  constraint different_player_emails check (lower(player_1_email) <> lower(player_2_email))
);

create index team_submissions_status_idx on team_submissions(status, created_at desc);

alter table team_submissions enable row level security;

-- Anyone (including anonymous visitors) can submit a team for review.
create policy "anyone can submit a team"
  on team_submissions for insert
  with check (true);

-- Only admins can read or modify submissions.
create policy "admins read submissions"
  on team_submissions for select
  using (is_admin(auth.uid()));

create policy "admins update submissions"
  on team_submissions for update
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

create policy "admins delete submissions"
  on team_submissions for delete
  using (is_admin(auth.uid()));

-- Stream submission changes so the admin console updates live.
alter publication supabase_realtime add table team_submissions;

-- Mark a submission as rejected (admin-only RPC for convenience).
create or replace function reject_team_submission(p_submission_id uuid, p_reason text default null)
returns team_submissions language plpgsql security definer set search_path = public as $$
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
