import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validation";

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
  const supabase = await createClient();

  const { error } = await supabase.from("team_submissions").insert({
    team_name: data.team_name,
    team_bio: data.team_bio || null,
    player_1_name: data.player_1.full_name,
    player_1_email: data.player_1.email,
    player_1_bio: data.player_1.bio || null,
    player_1_experience: data.player_1.experience,
    player_2_name: data.player_2.full_name,
    player_2_email: data.player_2.email,
    player_2_bio: data.player_2.bio || null,
    player_2_experience: data.player_2.experience,
  });

  if (error) {
    return NextResponse.json(
      { error: "submission_insert", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
