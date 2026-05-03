import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isAdminRole } from "@/lib/auth";
import { SPORTS } from "@/lib/sports";
import type { ExperienceLevel, Sport } from "@/lib/database.types";

export const runtime = "nodejs";

type ExperienceMap = Record<Sport, ExperienceLevel>;

type SubmissionRow = {
  id: string;
  status: "pending" | "approved" | "rejected";
  first_name: string;
  last_name: string;
  nickname: string | null;
  email: string;
  bio: string | null;
  experience: unknown;
};

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

  // 2. Read submission via the admin's session (RLS allows admins to read).
  const { data: submission, error: subErr } = await supabase
    .from("player_submissions")
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
      { error: "already_reviewed", message: `Påmeldingen er allerede ${sub.status === "approved" ? "godkjent" : "avvist"}.` },
      { status: 409 },
    );
  }

  // 3. Invite (or look up) the auth user. Service role is needed only for
  //    Auth Admin API; SQL writes continue via the admin session.
  const adminAuth = createServiceClient();
  const origin = new URL(req.url).origin;
  const email = sub.email.toLowerCase();
  const fullName = `${sub.first_name} ${sub.last_name}`.trim();
  let userId: string | undefined;

  const invite = await adminAuth.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      nickname: sub.nickname ?? "",
      bio: sub.bio ?? "",
    },
    redirectTo: `${origin}/auth/callback?next=/dashboard`,
  });
  if (invite.error) {
    const { data: existing, error: listErr } = await adminAuth.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      return NextResponse.json(
        { error: "auth_lookup", message: listErr.message },
        { status: 500 },
      );
    }
    const found = existing?.users.find((u) => u.email?.toLowerCase() === email);
    if (!found) {
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
    return NextResponse.json(
      { error: "auth_invite_no_user", message: "Autentiseringsleverandøren returnerte ingen bruker." },
      { status: 500 },
    );
  }

  // 4. Make sure the profile reflects nickname/bio/full_name even if the
  //    handle_new_user trigger ran earlier (e.g. existing user re-invited).
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      nickname: sub.nickname,
      bio: sub.bio,
    })
    .eq("id", userId);
  if (profileErr) {
    return NextResponse.json(
      { error: "profile_update", message: profileErr.message },
      { status: 500 },
    );
  }

  // 5. Save experience levels (admin RLS allows).
  const experience = sub.experience as ExperienceMap;
  const rows = SPORTS.map((s) => ({
    profile_id: userId!,
    sport: s.key,
    level: experience[s.key],
  }));
  const { error: expErr } = await supabase
    .from("player_experience")
    .upsert(rows, { onConflict: "profile_id,sport" });
  if (expErr) {
    return NextResponse.json(
      { error: "experience", message: expErr.message },
      { status: 500 },
    );
  }

  // 6. Mark the submission approved.
  const { error: updateErr } = await supabase
    .from("player_submissions")
    .update({
      status: "approved",
      approved_profile_id: userId,
      reviewed_by: authUser.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (updateErr) {
    return NextResponse.json(
      { error: "submission_update", message: updateErr.message, profile_id: userId },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, profile_id: userId });
}
