import { createClient } from "@/lib/supabase/server";
import type { Profile, Team } from "@/lib/database.types";

export type SessionUser = {
  id: string;
  profile: Profile | null;
  team: Team | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, teams(*)")
    .eq("profile_id", user.id)
    .maybeSingle();

  // The join with teams returns the relation; pull it out cleanly.
  // Supabase types nested relations as arrays — flatten to a single team.
  const teamsRel = (membership as { teams: Team | Team[] | null } | null)?.teams ?? null;
  const team = Array.isArray(teamsRel) ? (teamsRel[0] ?? null) : teamsRel;

  return {
    id: user.id,
    profile: profile ?? null,
    team,
  };
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user?.profile) return null;
  if (user.profile.role !== "admin" && user.profile.role !== "super_admin") {
    return null;
  }
  return user;
}
