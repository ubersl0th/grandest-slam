import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validation";
import { SPORTS } from "@/lib/sports";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const supabase = createServiceClient();

  // 1. Create the team.
  const { data: team, error: teamErr } = await supabase
    .from("teams")
    .insert({ name: data.team_name, bio: data.team_bio || null })
    .select()
    .single();

  if (teamErr || !team) {
    if (teamErr?.code === "23505") {
      return NextResponse.json(
        { error: "team_name_taken", message: "Team name is already taken." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "team_insert", message: teamErr?.message ?? "Could not create team." },
      { status: 500 },
    );
  }

  const origin = new URL(req.url).origin;

  // 2. For each player: invite by email (creates auth user + sends magic link),
  //    upsert the profile, attach to the team, save experience levels.
  const players = [data.player_1, data.player_2];
  for (const p of players) {
    // Try to invite a fresh user. If already exists (e.g. previous tournament), just resend a magic link.
    const invite = await supabase.auth.admin.inviteUserByEmail(p.email, {
      data: { full_name: p.full_name },
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
    });

    let userId: string | undefined = invite.data.user?.id;
    if (invite.error) {
      // User exists — fetch existing user.
      const { data: existing, error: listErr } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (listErr || !existing) {
        await rollback(supabase, team.id);
        return NextResponse.json(
          { error: "auth_lookup", message: listErr?.message ?? "Could not look up user." },
          { status: 500 },
        );
      }
      const found = existing.users.find((u) => u.email?.toLowerCase() === p.email);
      if (!found) {
        await rollback(supabase, team.id);
        return NextResponse.json(
          { error: "auth_invite", message: invite.error.message },
          { status: 500 },
        );
      }
      userId = found.id;

      // Send a fresh magic link.
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: p.email,
        options: { redirectTo: `${origin}/auth/callback?next=/dashboard` },
      });
    }

    if (!userId) {
      await rollback(supabase, team.id);
      return NextResponse.json(
        { error: "auth_invite_no_user", message: "Auth provider returned no user." },
        { status: 500 },
      );
    }

    // Upsert profile (the trigger may have already created one).
    const { error: profileErr } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: p.email,
        full_name: p.full_name,
        bio: p.bio || null,
      },
      { onConflict: "id" },
    );
    if (profileErr) {
      await rollback(supabase, team.id);
      return NextResponse.json(
        { error: "profile_upsert", message: profileErr.message },
        { status: 500 },
      );
    }

    // Attach to team. (Will fail if user already on another team — surface that.)
    const { error: memberErr } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, profile_id: userId });
    if (memberErr) {
      await rollback(supabase, team.id);
      const msg =
        memberErr.code === "23505"
          ? `${p.email} is already on another team`
          : memberErr.message;
      return NextResponse.json({ error: "team_member", message: msg }, { status: 409 });
    }

    // Experience per sport.
    const rows = SPORTS.map((s) => ({
      profile_id: userId!,
      sport: s.key,
      level: p.experience[s.key],
    }));
    const { error: expErr } = await supabase
      .from("player_experience")
      .upsert(rows, { onConflict: "profile_id,sport" });
    if (expErr) {
      await rollback(supabase, team.id);
      return NextResponse.json(
        { error: "experience", message: expErr.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, team_id: team.id });
}

async function rollback(
  supabase: ReturnType<typeof createServiceClient>,
  teamId: string,
) {
  await supabase.from("teams").delete().eq("id", teamId);
}
