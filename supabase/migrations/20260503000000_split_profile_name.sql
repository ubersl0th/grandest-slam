-- =====================================================================
-- Split profiles.full_name into first_name + last_name to match the join
-- form, which collects them separately. full_name is preserved as a
-- generated stored column so existing reads (admin lists, match views,
-- dashboard greeting, ordering) keep working without churn.
-- =====================================================================

alter table profiles
  add column first_name text,
  add column last_name text;

-- Best-effort backfill: split on the first whitespace.
update profiles
set first_name = nullif(split_part(full_name, ' ', 1), ''),
    last_name = nullif(btrim(regexp_replace(full_name, '^\S+\s*', '')), '');

-- Safety net: if any row ended up without a first_name (shouldn't happen
-- since full_name was NOT NULL), fall back to the email local-part.
update profiles
set first_name = split_part(email, '@', 1)
where first_name is null or first_name = '';

alter table profiles alter column first_name set not null;

-- Replace the original full_name column with a generated column derived
-- from the split parts, so callers that read full_name keep working.
alter table profiles drop column full_name;
alter table profiles
  add column full_name text generated always as (
    case
      when last_name is null or last_name = '' then first_name
      else first_name || ' ' || last_name
    end
  ) stored;

-- Update handle_new_user() to read first_name/last_name from invite
-- metadata (with full_name as a backwards-compatible fallback).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
  first_name_val text;
  last_name_val text;
  nickname_val text;
  bio_val text;
begin
  select count(*) = 0 into is_first from profiles;
  first_name_val := nullif(new.raw_user_meta_data->>'first_name', '');
  last_name_val := nullif(new.raw_user_meta_data->>'last_name', '');
  if first_name_val is null then
    first_name_val := coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(new.email, '@', 1)
    );
  end if;
  nickname_val := nullif(new.raw_user_meta_data->>'nickname', '');
  bio_val := nullif(new.raw_user_meta_data->>'bio', '');
  insert into profiles (id, email, first_name, last_name, nickname, bio, role)
  values (
    new.id,
    new.email,
    first_name_val,
    last_name_val,
    nickname_val,
    bio_val,
    case when is_first then 'super_admin'::user_role else 'player'::user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
