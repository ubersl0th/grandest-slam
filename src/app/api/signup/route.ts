import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { playerSubmissionSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = playerSubmissionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("player_submissions").insert({
    first_name: data.first_name,
    last_name: data.last_name,
    nickname: data.nickname || null,
    email: data.email,
    bio: data.bio || null,
    experience: data.experience,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error: "duplicate_pending",
          message: "There's already a pending sign-up for that email.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "submission_insert", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
