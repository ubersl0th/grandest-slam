-- =====================================================================
-- generate_round_robin previously ran `delete from matches;` with no
-- WHERE clause, which Supabase's safeupdate guard rejects with
-- "DELETE requires a WHERE clause" when called from the application.
-- Add a tautological predicate so the statement is accepted.
-- =====================================================================

create or replace function generate_round_robin()
returns int language plpgsql security definer set search_path = public as $$
declare
  count_inserted int := 0;
  s sport;
begin
  if not is_admin(auth.uid()) then raise exception 'admin only'; end if;
  delete from matches where true;
  for s in select unnest(array['padel'::sport, 'tennis'::sport]) loop
    insert into matches (sport, team_a, team_b)
    select s, t1.id, t2.id
    from teams t1
    cross join teams t2
    where t1.id < t2.id;
  end loop;
  get diagnostics count_inserted = row_count;
  return count_inserted;
end;
$$;
