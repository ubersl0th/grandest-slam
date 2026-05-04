-- =====================================================================
-- activity_log — admin-visible audit trail of every meaningful change.
-- =====================================================================
-- Powered by AFTER triggers on the source tables. Each entry captures who
-- did what, against which entity, plus a denormalized human-readable
-- summary so the UI can render without follow-up joins.
-- The publication is registered for realtime so the admin console can
-- subscribe and tail the log live.
-- =====================================================================

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references profiles(id) on delete set null,
  actor_name text,
  actor_role user_role,
  action text not null,
  target_type text,
  target_id uuid,
  target_label text,
  team_ids uuid[] not null default '{}',
  summary text not null,
  metadata jsonb
);

create index activity_log_created_at_idx on activity_log(created_at desc);
create index activity_log_actor_idx on activity_log(actor_id);
create index activity_log_action_idx on activity_log(action);
create index activity_log_target_idx on activity_log(target_type, target_id);
create index activity_log_team_ids_idx on activity_log using gin (team_ids);

alter table activity_log enable row level security;

create policy "activity_log readable by admins"
  on activity_log for select using (is_admin(auth.uid()));

-- Inserts only happen via the SECURITY DEFINER log_activity() helper.
-- Direct inserts from authenticated/anon are blocked by lack of grant.

revoke all on activity_log from anon, authenticated;
grant select on activity_log to authenticated;
grant all on activity_log to service_role;

alter publication supabase_realtime add table activity_log;

-- =====================================================================
-- log_activity — central writer used by every trigger / RPC.
-- =====================================================================
-- Honors a session-local kill switch (`app.suppress_activity_log = on`)
-- so bulk RPCs (e.g. generate_round_robin) can replace per-row spam with
-- a single summary entry.
-- =====================================================================

create or replace function log_activity(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_target_label text,
  p_team_ids uuid[],
  p_summary text,
  p_metadata jsonb default null,
  p_actor_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid;
  v_actor_name text;
  v_actor_role user_role;
begin
  if coalesce(current_setting('app.suppress_activity_log', true), 'off') = 'on' then
    return;
  end if;

  v_actor := coalesce(p_actor_id, auth.uid());
  if v_actor is not null then
    select coalesce(nullif(nickname, ''), full_name, email), role
      into v_actor_name, v_actor_role
      from profiles where id = v_actor;
  end if;

  insert into activity_log (
    actor_id, actor_name, actor_role,
    action, target_type, target_id, target_label,
    team_ids, summary, metadata
  ) values (
    v_actor, v_actor_name, v_actor_role,
    p_action, p_target_type, p_target_id, p_target_label,
    coalesce(p_team_ids, '{}'::uuid[]), p_summary, p_metadata
  );
end;
$$;

-- =====================================================================
-- Trigger functions
-- =====================================================================

-- profiles ------------------------------------------------------------
create or replace function log_profile_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  display_name text;
begin
  display_name := coalesce(nullif(new.nickname, ''), new.full_name, new.email);
  if tg_op = 'INSERT' then
    perform log_activity(
      'profile.created', 'profile', new.id, display_name, null,
      format('Spilleren %s ble registrert', display_name),
      jsonb_build_object('email', new.email, 'role', new.role),
      new.id
    );
  elsif tg_op = 'UPDATE' then
    if old.role is distinct from new.role then
      perform log_activity(
        'profile.role_changed', 'profile', new.id, display_name, null,
        format('Endret rolle for %s fra %s til %s', display_name, old.role, new.role),
        jsonb_build_object('from', old.role, 'to', new.role)
      );
    end if;
    if (old.first_name is distinct from new.first_name)
       or (old.last_name is distinct from new.last_name)
       or (old.nickname is distinct from new.nickname)
       or (old.bio is distinct from new.bio)
       or (old.email is distinct from new.email) then
      perform log_activity(
        'profile.updated', 'profile', new.id, display_name, null,
        format('Oppdaterte profilen til %s', display_name),
        null
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger profiles_activity_log
after insert or update on profiles
for each row execute function log_profile_change();

-- teams ---------------------------------------------------------------
create or replace function log_team_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform log_activity(
      'team.created', 'team', new.id, new.name, array[new.id],
      format('Opprettet laget «%s»', new.name),
      null
    );
  elsif tg_op = 'UPDATE' then
    if old.name is distinct from new.name then
      perform log_activity(
        'team.renamed', 'team', new.id, new.name, array[new.id],
        format('Endret lagnavn fra «%s» til «%s»', old.name, new.name),
        jsonb_build_object('from', old.name, 'to', new.name)
      );
    end if;
    if old.bio is distinct from new.bio then
      perform log_activity(
        'team.updated', 'team', new.id, new.name, array[new.id],
        format('Oppdaterte beskrivelsen til «%s»', new.name),
        null
      );
    end if;
  elsif tg_op = 'DELETE' then
    perform log_activity(
      'team.deleted', 'team', old.id, old.name, array[old.id],
      format('Slettet laget «%s»', old.name),
      null
    );
  end if;
  return null;
end;
$$;

create trigger teams_activity_log
after insert or update or delete on teams
for each row execute function log_team_change();

-- team_members --------------------------------------------------------
create or replace function log_team_member_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  player_name text;
  team_name text;
  rec_profile uuid;
  rec_team uuid;
begin
  if tg_op = 'INSERT' then
    rec_profile := new.profile_id;
    rec_team := new.team_id;
  else
    rec_profile := old.profile_id;
    rec_team := old.team_id;
  end if;

  select coalesce(nullif(nickname, ''), full_name, email)
    into player_name from profiles where id = rec_profile;
  select name into team_name from teams where id = rec_team;

  if tg_op = 'INSERT' then
    perform log_activity(
      'team_member.added', 'team', rec_team, team_name, array[rec_team],
      format('La til %s på laget «%s»', coalesce(player_name, '(ukjent spiller)'), coalesce(team_name, '(ukjent lag)')),
      jsonb_build_object('profile_id', rec_profile)
    );
  elsif tg_op = 'DELETE' then
    perform log_activity(
      'team_member.removed', 'team', rec_team, team_name, array[rec_team],
      format('Fjernet %s fra laget «%s»', coalesce(player_name, '(ukjent spiller)'), coalesce(team_name, '(ukjent lag)')),
      jsonb_build_object('profile_id', rec_profile)
    );
  end if;
  return null;
end;
$$;

create trigger team_members_activity_log
after insert or delete on team_members
for each row execute function log_team_member_change();

-- player_experience ---------------------------------------------------
create or replace function log_player_experience_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  player_name text;
  rec_profile uuid;
  rec_sport sport;
  rec_level experience_level;
begin
  if tg_op = 'DELETE' then
    rec_profile := old.profile_id;
    rec_sport := old.sport;
    rec_level := old.level;
  else
    rec_profile := new.profile_id;
    rec_sport := new.sport;
    rec_level := new.level;
  end if;
  -- Only emit on UPDATE if the level actually changed; skip insert noise
  -- (handled implicitly by the parent submission/profile event).
  if tg_op = 'UPDATE' and old.level is not distinct from new.level then
    return null;
  end if;
  if tg_op = 'INSERT' then return null; end if;

  select coalesce(nullif(nickname, ''), full_name, email)
    into player_name from profiles where id = rec_profile;

  perform log_activity(
    'experience.updated', 'profile', rec_profile, player_name, null,
    format('Endret %s-nivå for %s til %s', rec_sport, coalesce(player_name, '(ukjent)'), rec_level),
    jsonb_build_object('sport', rec_sport, 'level', rec_level)
  );
  return null;
end;
$$;

create trigger player_experience_activity_log
after update or delete on player_experience
for each row execute function log_player_experience_change();

-- matches -------------------------------------------------------------
create or replace function log_match_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  team_a_name text;
  team_b_name text;
  matchup text;
begin
  if tg_op = 'DELETE' then
    select name into team_a_name from teams where id = old.team_a;
    select name into team_b_name from teams where id = old.team_b;
    matchup := coalesce(team_a_name, '(ukjent)') || ' mot ' || coalesce(team_b_name, '(ukjent)');
    perform log_activity(
      'match.deleted', 'match', old.id, matchup, array[old.team_a, old.team_b],
      format('Slettet %s-kamp: %s', old.sport, matchup),
      jsonb_build_object('sport', old.sport)
    );
    return null;
  end if;

  select name into team_a_name from teams where id = new.team_a;
  select name into team_b_name from teams where id = new.team_b;
  matchup := coalesce(team_a_name, '(ukjent)') || ' mot ' || coalesce(team_b_name, '(ukjent)');

  if tg_op = 'INSERT' then
    perform log_activity(
      'match.created', 'match', new.id, matchup, array[new.team_a, new.team_b],
      format('Opprettet %s-kamp: %s', new.sport, matchup),
      jsonb_build_object('sport', new.sport)
    );
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      if new.status = 'pending' then
        perform log_activity(
          'match.submitted', 'match', new.id, matchup, array[new.team_a, new.team_b],
          format('Registrerte resultat %s–%s i %s (%s)', new.score_a, new.score_b, new.sport, matchup),
          jsonb_build_object('sport', new.sport, 'score_a', new.score_a, 'score_b', new.score_b)
        );
      elsif new.status = 'confirmed' then
        perform log_activity(
          'match.confirmed', 'match', new.id, matchup, array[new.team_a, new.team_b],
          format('Bekreftet resultat %s–%s i %s (%s)', new.score_a, new.score_b, new.sport, matchup),
          jsonb_build_object('sport', new.sport, 'score_a', new.score_a, 'score_b', new.score_b)
        );
      elsif new.status = 'disputed' then
        perform log_activity(
          'match.disputed', 'match', new.id, matchup, array[new.team_a, new.team_b],
          format('Bestred resultatet i %s (%s)', new.sport, matchup),
          jsonb_build_object('sport', new.sport)
        );
      end if;
    elsif (old.score_a is distinct from new.score_a)
       or (old.score_b is distinct from new.score_b)
       or (old.notes is distinct from new.notes) then
      perform log_activity(
        'match.updated', 'match', new.id, matchup, array[new.team_a, new.team_b],
        format('Oppdaterte detaljer i %s (%s)', new.sport, matchup),
        jsonb_build_object('sport', new.sport)
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger matches_activity_log
after insert or update or delete on matches
for each row execute function log_match_change();

-- flights -------------------------------------------------------------
create or replace function log_flight_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  team_1_name text;
  team_2_name text;
  matchup text;
begin
  if tg_op = 'DELETE' then
    select name into team_1_name from teams where id = old.team_1;
    select name into team_2_name from teams where id = old.team_2;
    matchup := coalesce(team_1_name, '(ukjent)') || ' mot ' || coalesce(team_2_name, '(ukjent)');
    perform log_activity(
      'flight.deleted', 'flight', old.id, matchup, array[old.team_1, old.team_2],
      format('Slettet %s-runde %s: %s', old.sport, old.round_number, matchup),
      jsonb_build_object('sport', old.sport, 'round_number', old.round_number)
    );
    return null;
  end if;

  select name into team_1_name from teams where id = new.team_1;
  select name into team_2_name from teams where id = new.team_2;
  matchup := coalesce(team_1_name, '(ukjent)') || ' mot ' || coalesce(team_2_name, '(ukjent)');

  if tg_op = 'INSERT' then
    perform log_activity(
      'flight.created', 'flight', new.id, matchup, array[new.team_1, new.team_2],
      format('Opprettet %s-runde %s: %s', new.sport, new.round_number, matchup),
      jsonb_build_object('sport', new.sport, 'round_number', new.round_number)
    );
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      if new.status = 'pending' then
        perform log_activity(
          'flight.submitted', 'flight', new.id, matchup, array[new.team_1, new.team_2],
          format('Registrerte slag %s–%s i %s (%s)', new.strokes_1, new.strokes_2, new.sport, matchup),
          jsonb_build_object('sport', new.sport, 'strokes_1', new.strokes_1, 'strokes_2', new.strokes_2)
        );
      elsif new.status = 'confirmed' then
        perform log_activity(
          'flight.confirmed', 'flight', new.id, matchup, array[new.team_1, new.team_2],
          format('Bekreftet slag %s–%s i %s (%s)', new.strokes_1, new.strokes_2, new.sport, matchup),
          jsonb_build_object('sport', new.sport, 'strokes_1', new.strokes_1, 'strokes_2', new.strokes_2)
        );
      elsif new.status = 'disputed' then
        perform log_activity(
          'flight.disputed', 'flight', new.id, matchup, array[new.team_1, new.team_2],
          format('Bestred runden i %s (%s)', new.sport, matchup),
          jsonb_build_object('sport', new.sport)
        );
      end if;
    elsif (old.strokes_1 is distinct from new.strokes_1)
       or (old.strokes_2 is distinct from new.strokes_2)
       or (old.scheduled_at is distinct from new.scheduled_at)
       or (old.notes is distinct from new.notes) then
      perform log_activity(
        'flight.updated', 'flight', new.id, matchup, array[new.team_1, new.team_2],
        format('Oppdaterte detaljer i %s (%s)', new.sport, matchup),
        jsonb_build_object('sport', new.sport)
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger flights_activity_log
after insert or update or delete on flights
for each row execute function log_flight_change();

-- player_submissions --------------------------------------------------
create or replace function log_player_submission_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  display_name text;
begin
  if tg_op = 'DELETE' then
    display_name := btrim(coalesce(old.first_name, '') || ' ' || coalesce(old.last_name, ''));
    if display_name = '' then display_name := old.email; end if;
    perform log_activity(
      'submission.deleted', 'submission', old.id, display_name, null,
      format('Slettet påmelding fra %s', display_name),
      jsonb_build_object('email', old.email)
    );
    return null;
  end if;

  display_name := btrim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, ''));
  if display_name = '' then display_name := new.email; end if;

  if tg_op = 'INSERT' then
    perform log_activity(
      'submission.created', 'submission', new.id, display_name, null,
      format('Mottok ny påmelding fra %s', display_name),
      jsonb_build_object('email', new.email)
    );
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'approved' then
      perform log_activity(
        'submission.approved', 'submission', new.id, display_name, null,
        format('Godkjente påmelding fra %s', display_name),
        jsonb_build_object('email', new.email, 'profile_id', new.approved_profile_id)
      );
    elsif new.status = 'rejected' then
      perform log_activity(
        'submission.rejected', 'submission', new.id, display_name, null,
        format('Avviste påmelding fra %s', display_name),
        jsonb_build_object('email', new.email, 'reason', new.rejection_reason)
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger player_submissions_activity_log
after insert or update or delete on player_submissions
for each row execute function log_player_submission_change();

-- tournament ----------------------------------------------------------
create or replace function log_tournament_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      if new.status = 'active' then
        perform log_activity(
          'tournament.started', 'tournament', null, new.name, null,
          format('Startet turneringen «%s»', new.name),
          null
        );
      elsif new.status = 'completed' then
        perform log_activity(
          'tournament.ended', 'tournament', null, new.name, null,
          format('Avsluttet turneringen «%s»', new.name),
          null
        );
      end if;
    elsif (old.name is distinct from new.name)
       or (old.golf_rounds is distinct from new.golf_rounds)
       or (old.disc_golf_rounds is distinct from new.disc_golf_rounds) then
      perform log_activity(
        'tournament.updated', 'tournament', null, new.name, null,
        format('Oppdaterte turneringsinnstillinger for «%s»', new.name),
        null
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger tournament_activity_log
after update on tournament
for each row execute function log_tournament_change();

-- =====================================================================
-- Replace generate_round_robin so it emits one summary instead of
-- N inserts × team-pair noise.
-- =====================================================================
create or replace function generate_round_robin()
returns int language plpgsql security definer set search_path = public as $$
declare
  count_inserted int := 0;
  count_deleted int := 0;
  s sport;
begin
  if not is_admin(auth.uid()) then raise exception 'admin only'; end if;
  perform set_config('app.suppress_activity_log', 'on', true);
  delete from matches;
  get diagnostics count_deleted = row_count;
  for s in select unnest(array['padel'::sport, 'tennis'::sport]) loop
    insert into matches (sport, team_a, team_b)
    select s, t1.id, t2.id
    from teams t1
    cross join teams t2
    where t1.id < t2.id;
  end loop;
  get diagnostics count_inserted = row_count;
  perform set_config('app.suppress_activity_log', 'off', true);
  perform log_activity(
    'schedule.generated', 'tournament', null, null, null,
    format('Genererte serieoppsett for Padel og Tennis (%s nye kamper)', count_inserted),
    jsonb_build_object('matches_created', count_inserted, 'matches_deleted', count_deleted)
  );
  return count_inserted;
end;
$$;
