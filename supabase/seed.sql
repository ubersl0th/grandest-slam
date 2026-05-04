-- =====================================================================
-- Local development seed.
-- =====================================================================
-- Runs after migrations on `supabase db reset` (and on first
-- `supabase start`). Creates a super_admin, an admin, eight players,
-- three teams, a padel/tennis round-robin, a few flights, and a few
-- result states so every screen has data.
--
-- All seeded users sign in at /auth/sign-in with email + password "password".
-- Inbucket (http://127.0.0.1:54324) catches any magic-link emails too.
--
-- NOTE: We avoid PL/pgSQL helpers in this file because the Supabase CLI
-- pipes seeds through batched parse-then-execute, which means a freshly
-- created function isn't visible to later SELECTs in the same batch.
-- Everything below is plain INSERT...VALUES.
-- =====================================================================

-- Hide all the seeded changes from the activity log so the feed starts
-- empty. We add a single summary entry at the very end.
select set_config('app.suppress_activity_log', 'on', false);

-- =====================================================================
-- auth.users — bulk insert. The handle_new_user trigger reads
-- first_name / last_name / nickname from raw_user_meta_data and creates
-- a profiles row for each. We override roles explicitly below so we
-- don't depend on row insertion order.
-- =====================================================================

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  v.id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated', 'authenticated',
  v.email,
  crypt('password', gen_salt('bf')),
  now(),
  jsonb_build_object('provider', 'email', 'providers', array['email']),
  jsonb_build_object(
    'first_name', v.first_name,
    'last_name', v.last_name,
    'nickname', coalesce(v.nickname, '')
  ),
  now(), now(),
  '', '', '', ''
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'admin@grandest-slam.no',   'Astrid',  'Admin',      'Boss'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'mod@grandest-slam.no',     'Magnus',  'Moderator',  'Mod'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'alice@grandest-slam.no',   'Alice',   'Andersen',   null),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'bob@grandest-slam.no',     'Bob',     'Berg',       'Bobbo'),
  ('00000000-0000-0000-0000-000000000005'::uuid, 'charlie@grandest-slam.no', 'Charlie', 'Carlsen',    null),
  ('00000000-0000-0000-0000-000000000006'::uuid, 'dora@grandest-slam.no',    'Dora',    'Dahl',       null),
  ('00000000-0000-0000-0000-000000000007'::uuid, 'erik@grandest-slam.no',    'Erik',    'Eriksen',    null),
  ('00000000-0000-0000-0000-000000000008'::uuid, 'fiona@grandest-slam.no',   'Fiona',   'Fjeld',      null),
  ('00000000-0000-0000-0000-000000000009'::uuid, 'gunnar@grandest-slam.no',  'Gunnar',  'Grøn',       null),
  ('00000000-0000-0000-0000-00000000000a'::uuid, 'hilde@grandest-slam.no',   'Hilde',   'Halvorsen',  null)
) as v(id, email, first_name, last_name, nickname);

-- Set roles deterministically: the trigger picks one row as super_admin,
-- but we want it to be admin@grandest-slam.no regardless.
update profiles set role = case
  when id = '00000000-0000-0000-0000-000000000001'::uuid then 'super_admin'::user_role
  when id = '00000000-0000-0000-0000-000000000002'::uuid then 'admin'::user_role
  else 'player'::user_role
end;

-- =====================================================================
-- auth.identities — required for password sign-in to work.
-- =====================================================================

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true
  ),
  'email',
  u.id::text,
  now(), now(), now()
from auth.users u
where u.email in (
  'admin@grandest-slam.no', 'mod@grandest-slam.no',
  'alice@grandest-slam.no', 'bob@grandest-slam.no', 'charlie@grandest-slam.no',
  'dora@grandest-slam.no', 'erik@grandest-slam.no', 'fiona@grandest-slam.no',
  'gunnar@grandest-slam.no', 'hilde@grandest-slam.no'
);

-- =====================================================================
-- Player experience — every player rated in every sport.
-- =====================================================================

insert into player_experience (profile_id, sport, level) values
  ('00000000-0000-0000-0000-000000000003'::uuid, 'padel',     'intermediate'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'tennis',    'advanced'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'disc_golf', 'beginner'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'golf',      'intermediate'),

  ('00000000-0000-0000-0000-000000000004'::uuid, 'padel',     'beginner'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'tennis',    'intermediate'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'disc_golf', 'advanced'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'golf',      'beginner'),

  ('00000000-0000-0000-0000-000000000005'::uuid, 'padel',     'advanced'),
  ('00000000-0000-0000-0000-000000000005'::uuid, 'tennis',    'intermediate'),
  ('00000000-0000-0000-0000-000000000005'::uuid, 'disc_golf', 'intermediate'),
  ('00000000-0000-0000-0000-000000000005'::uuid, 'golf',      'advanced'),

  ('00000000-0000-0000-0000-000000000006'::uuid, 'padel',     'intermediate'),
  ('00000000-0000-0000-0000-000000000006'::uuid, 'tennis',    'beginner'),
  ('00000000-0000-0000-0000-000000000006'::uuid, 'disc_golf', 'beginner'),
  ('00000000-0000-0000-0000-000000000006'::uuid, 'golf',      'intermediate'),

  ('00000000-0000-0000-0000-000000000007'::uuid, 'padel',     'beginner'),
  ('00000000-0000-0000-0000-000000000007'::uuid, 'tennis',    'advanced'),
  ('00000000-0000-0000-0000-000000000007'::uuid, 'disc_golf', 'intermediate'),
  ('00000000-0000-0000-0000-000000000007'::uuid, 'golf',      'beginner'),

  ('00000000-0000-0000-0000-000000000008'::uuid, 'padel',     'advanced'),
  ('00000000-0000-0000-0000-000000000008'::uuid, 'tennis',    'beginner'),
  ('00000000-0000-0000-0000-000000000008'::uuid, 'disc_golf', 'advanced'),
  ('00000000-0000-0000-0000-000000000008'::uuid, 'golf',      'intermediate'),

  ('00000000-0000-0000-0000-000000000009'::uuid, 'padel',     'intermediate'),
  ('00000000-0000-0000-0000-000000000009'::uuid, 'tennis',    'intermediate'),
  ('00000000-0000-0000-0000-000000000009'::uuid, 'disc_golf', 'beginner'),
  ('00000000-0000-0000-0000-000000000009'::uuid, 'golf',      'advanced'),

  ('00000000-0000-0000-0000-00000000000a'::uuid, 'padel',     'beginner'),
  ('00000000-0000-0000-0000-00000000000a'::uuid, 'tennis',    'intermediate'),
  ('00000000-0000-0000-0000-00000000000a'::uuid, 'disc_golf', 'intermediate'),
  ('00000000-0000-0000-0000-00000000000a'::uuid, 'golf',      'beginner');

-- =====================================================================
-- Teams — three pairs; Gunnar and Hilde are left unassigned so the
-- "Generer lag automatisk" flow has someone to balance.
-- =====================================================================

insert into teams (id, name, bio) values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'Smashing Pumpkins', 'Padel og picknick.'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'Tee Time Tigers',   'Forsiktig optimistiske.'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'Disc Dynamos',      'Vinden er en venn.');

insert into team_members (team_id, profile_id) values
  ('11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000003'::uuid),
  ('11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0000-000000000004'::uuid),

  ('22222222-2222-2222-2222-222222222222'::uuid, '00000000-0000-0000-0000-000000000005'::uuid),
  ('22222222-2222-2222-2222-222222222222'::uuid, '00000000-0000-0000-0000-000000000006'::uuid),

  ('33333333-3333-3333-3333-333333333333'::uuid, '00000000-0000-0000-0000-000000000007'::uuid),
  ('33333333-3333-3333-3333-333333333333'::uuid, '00000000-0000-0000-0000-000000000008'::uuid);

-- =====================================================================
-- Padel + tennis round-robin (3 teams → 3 matches per sport).
-- =====================================================================

insert into matches (id, sport, team_a, team_b) values
  ('aaaaaaa1-0000-0000-0000-000000000001'::uuid, 'padel',
    '11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid),
  ('aaaaaaa1-0000-0000-0000-000000000002'::uuid, 'padel',
    '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333333'::uuid),
  ('aaaaaaa1-0000-0000-0000-000000000003'::uuid, 'padel',
    '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333333'::uuid),
  ('bbbbbbb1-0000-0000-0000-000000000001'::uuid, 'tennis',
    '11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid),
  ('bbbbbbb1-0000-0000-0000-000000000002'::uuid, 'tennis',
    '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333333'::uuid),
  ('bbbbbbb1-0000-0000-0000-000000000003'::uuid, 'tennis',
    '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333333'::uuid);

-- A confirmed padel result so the leaderboard isn't empty.
update matches set
  score_a = 6, score_b = 4,
  winner_team_id = team_a,
  submitted_by = '00000000-0000-0000-0000-000000000003'::uuid,
  submitted_at = now() - interval '2 hours',
  confirmed_by = '00000000-0000-0000-0000-000000000005'::uuid,
  confirmed_at = now() - interval '1 hour',
  status = 'confirmed'
where id = 'aaaaaaa1-0000-0000-0000-000000000001'::uuid;

-- A pending tennis result waiting for the opposing team to confirm.
update matches set
  score_a = 6, score_b = 7,
  winner_team_id = team_b,
  submitted_by = '00000000-0000-0000-0000-000000000005'::uuid,
  submitted_at = now() - interval '15 minutes',
  status = 'pending'
where id = 'bbbbbbb1-0000-0000-0000-000000000001'::uuid;

-- =====================================================================
-- Flights — two disc-golf flights and one confirmed golf flight.
-- =====================================================================

insert into flights (id, sport, round_number, team_1, team_2) values
  ('cccccccc-0000-0000-0000-000000000001'::uuid, 'disc_golf', 1,
    '11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid),
  ('cccccccc-0000-0000-0000-000000000002'::uuid, 'disc_golf', 1,
    '22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333333'::uuid),
  ('dddddddd-0000-0000-0000-000000000001'::uuid, 'golf', 1,
    '11111111-1111-1111-1111-111111111111'::uuid, '33333333-3333-3333-3333-333333333333'::uuid);

update flights set
  strokes_1 = 58, strokes_2 = 62,
  submitted_by = '00000000-0000-0000-0000-000000000003'::uuid,
  submitted_at = now() - interval '3 hours',
  confirmed_by = '00000000-0000-0000-0000-000000000005'::uuid,
  confirmed_at = now() - interval '2 hours',
  status = 'confirmed'
where id = 'cccccccc-0000-0000-0000-000000000001'::uuid;

-- =====================================================================
-- A pending player_submission so the admin Påmeldinger tab has work.
-- =====================================================================

insert into player_submissions (
  first_name, last_name, nickname, email, bio, experience
) values (
  'Ingrid', 'Iversen', 'Ingie', 'ingrid@grandest-slam.no',
  'Spilte tennis i college, har aldri rørt frisbeegolf.',
  '{"padel": "intermediate", "tennis": "advanced", "disc_golf": "beginner", "golf": "beginner"}'::jsonb
);

-- =====================================================================
-- Re-enable activity logging and add a single marker entry.
-- =====================================================================

select set_config('app.suppress_activity_log', 'off', false);

select log_activity(
  'seed.completed',
  'tournament',
  null::uuid,
  null::text,
  null::uuid[],
  'Lokalt utviklingsmiljø ble seedet med demo-data',
  jsonb_build_object('users', 10, 'teams', 3, 'matches', 6, 'flights', 3),
  '00000000-0000-0000-0000-000000000001'::uuid
);
