-- =====================================================================
-- Track which team submitted a result, so the UI can filter "needs my
-- confirmation" precisely (a teammate of the submitter shouldn't be asked
-- to confirm — only the opposing team can).
-- =====================================================================

alter table matches add column submitted_by_team uuid references teams(id) on delete set null;
alter table flights add column submitted_by_team uuid references teams(id) on delete set null;

create index matches_submitted_by_team_idx on matches(submitted_by_team);
create index flights_submitted_by_team_idx on flights(submitted_by_team);

-- =====================================================================
-- Update submit RPCs to populate submitted_by_team.
-- Confirm RPCs now use this column too (cheaper than re-deriving from team_members).
-- =====================================================================

create or replace function submit_match_result(
  p_match_id uuid,
  p_score_a int,
  p_score_b int,
  p_notes text default null
) returns matches language plpgsql security definer set search_path = public as $$
declare
  m matches;
  uid uuid := auth.uid();
  submitter_team uuid;
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

  -- Determine which team the submitter belongs to (admins keep prior value or null).
  if is_team_member(uid, m.team_a) then
    submitter_team := m.team_a;
  elsif is_team_member(uid, m.team_b) then
    submitter_team := m.team_b;
  else
    submitter_team := null;
  end if;

  update matches set
    score_a = p_score_a,
    score_b = p_score_b,
    notes = p_notes,
    winner_team_id = case when p_score_a > p_score_b then team_a else team_b end,
    submitted_by = uid,
    submitted_by_team = coalesce(submitter_team, submitted_by_team),
    submitted_at = now(),
    confirmed_by = null,
    confirmed_at = null,
    status = 'pending'
  where id = p_match_id
  returning * into m;
  return m;
end;
$$;

create or replace function confirm_match_result(p_match_id uuid)
returns matches language plpgsql security definer set search_path = public as $$
declare
  m matches;
  uid uuid := auth.uid();
  opposing_team uuid;
begin
  select * into m from matches where id = p_match_id;
  if m.id is null then raise exception 'match not found'; end if;
  if m.status <> 'pending' then raise exception 'match is not pending'; end if;
  if not is_admin(uid) then
    if m.submitted_by_team is null then
      raise exception 'cannot determine submitter team — admin must resolve';
    end if;
    opposing_team := case when m.submitted_by_team = m.team_a then m.team_b else m.team_a end;
    if not is_team_member(uid, opposing_team) then
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

create or replace function submit_flight_result(
  p_flight_id uuid,
  p_strokes_1 int,
  p_strokes_2 int,
  p_notes text default null
) returns flights language plpgsql security definer set search_path = public as $$
declare
  f flights;
  uid uuid := auth.uid();
  submitter_team uuid;
begin
  select * into f from flights where id = p_flight_id;
  if f.id is null then raise exception 'flight not found'; end if;
  if not (is_team_member(uid, f.team_1) or is_team_member(uid, f.team_2) or is_admin(uid)) then
    raise exception 'not a participant';
  end if;
  if p_strokes_1 is null or p_strokes_2 is null or p_strokes_1 <= 0 or p_strokes_2 <= 0 then
    raise exception 'invalid strokes';
  end if;

  if is_team_member(uid, f.team_1) then
    submitter_team := f.team_1;
  elsif is_team_member(uid, f.team_2) then
    submitter_team := f.team_2;
  else
    submitter_team := null;
  end if;

  update flights set
    strokes_1 = p_strokes_1,
    strokes_2 = p_strokes_2,
    notes = p_notes,
    submitted_by = uid,
    submitted_by_team = coalesce(submitter_team, submitted_by_team),
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
  opposing_team uuid;
begin
  select * into f from flights where id = p_flight_id;
  if f.id is null then raise exception 'flight not found'; end if;
  if f.status <> 'pending' then raise exception 'flight is not pending'; end if;
  if not is_admin(uid) then
    if f.submitted_by_team is null then
      raise exception 'cannot determine submitter team — admin must resolve';
    end if;
    opposing_team := case when f.submitted_by_team = f.team_1 then f.team_2 else f.team_1 end;
    if not is_team_member(uid, opposing_team) then
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
