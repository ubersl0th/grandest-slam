import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth";
import { SPORTS } from "@/lib/sports";
import type { ExperienceLevel, Sport } from "@/lib/database.types";

export const runtime = "nodejs";

type ExperienceMap = Record<Sport, ExperienceLevel>;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Authenticate caller and verify admin role.
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authUser.id)
    .maybeSingle();
  if (!isAdminRole((callerProfile as { role?: string } | null)?.role as never)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 2. Read the submission via the admin's session — RLS allows admins to read.
  const { data: submission, error: subErr } = await supabase
    .from("team_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (subErr) {
    return NextResponse.json(
      { error: "submission_read", message: subErr.message },
      { status: 500 },
    );
  }
  if (!submission) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const sub = submission as SubmissionRow;
  if (sub.status !== "pending") {
    return NextResponse.json(
      { error: "already_reviewed", message: `Submission already ${sub.status}.` },
      { status: 409 },
    );
  }

  // 3. Create the team — admin RLS allows insert.
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .insert({ name: sub.team_name, bio: sub.team_bio })
    .select()
    .single();
  if (teamErr || !team) {
    if (teamErr?.code === "23505") {
      return NextResponse.json(
        { error: "team_name_taken", message: "Team name already taken." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "team_insert", message: teamErr?.message ?? "Could not create team." },
      { status: 500 },
    );
  }
  const teamRow = team as { id: string };

  // 4. Service role is needed ONLY for the Auth Admin API (inviting users
  //    by email). All SQL writes continue via the admin's session.
  const adminAuth = createServiceClient();
  const origin = new URL(req.url).origin;
  const players = [
    {
      name: sub.player_1_name,
      email: sub.player_1_email,
      bio: sub.player_1_bio,
      experience: sub.player_1_experience as ExperienceMap,
    },
    {
      name: sub.player_2_name,
      email: sub.player_2_email,
      bio: sub.player_2_bio,
      experience: sub.player_2_experience as ExperienceMap,
    },
  ];

  for (const p of players) {
    const email = p.email.toLowerCase();
    let userId: string | undefined;

    const invite = await adminAuth.auth.admin.inviteUserByEmail(email, {
      data: { full_name: p.name, bio: p.bio ?? "" },
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
    });
    if (invite.error) {
      // Likely already exists — look them up and resend a magic link instead.
      const { data: existing, error: listErr } = await adminAuth.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr) {
        await rollback(supabase, teamRow.id);
        return NextResponse.json(
          { error: "auth_lookup", message: listErr.message },
          { status: 500 },
        );
      }
      const found = existing?.users.find((u) => u.email?.toLowerCase() === email);
      if (!found) {
        await rollback(supabase, teamRow.id);
        return NextResponse.json(
          { error: "auth_invite", message: invite.error.message },
          { status: 500 },
        );
      }
      userId = found.id;
      await adminAuth.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${origin}/auth/callback?next=/dashboard` },
      });
    } else {
      userId = invite.data.user?.id;
    }
    if (!userId) {
      await rollback(supabase, teamRow.id);
      return NextResponse.json(
        { error: "auth_invite_no_user", message: "Auth provider returned no user." },
        { status: 500 },
      );
    }

    // 5. Attach the player to the team. Admin RLS allows.
    const { error: memberErr } = await supabase
      .from("team_members")
      .insert({ team_id: teamRow.id, profile_id: userId });
    if (memberErr) {
      await rollback(supabase, teamRow.id);
      const msg =
        memberErr.code === "23505"
          ? `${email} is already on another team`
          : memberErr.message;
      return NextResponse.json({ error: "team_member", message: msg }, { status: 409 });
    }

    // 6. Save experience levels. Admin RLS allows.
    const rows = SPORTS.map((s) => ({
      profile_id: userId!,
      sport: s.key,
      level: p.experience[s.key],
    }));
    const { error: expErr } = await supabase
      .from("player_experience")
      .upsert(rows, { onConflict: "profile_id,sport" });
    if (expErr) {
      await rollback(supabase, teamRow.id);
      return NextResponse.json(
        { error: "experience", message: expErr.message },
        { status: 500 },
      );
    }
  }

  // 7. Mark the submission as approved.
  const { error: updateErr } = await supabase
    .from("team_submissions")
    .update({
      status: "approved",
      approved_team_id: teamRow.id,
      reviewed_by: authUser.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateErr) {
    return NextResponse.json(
      { error: "submission_update", message: updateErr.message, team_id: teamRow.id },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, team_id: teamRow.id });
}

type SubmissionRow = {
  id: string;
  status: "pending" | "approved" | "rejected";
  team_name: string;
  team_bio: string | null;
  player_1_name: string;
  player_1_email: string;
  player_1_bio: string | null;
  player_1_experience: unknown;
  player_2_name: string;
  player_2_email: string;
  player_2_bio: string | null;
  player_2_experience: unknown;
};

async function rollback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamId: string,
) {
  await supabase.from("teams").delete().eq("id", teamId);
}
