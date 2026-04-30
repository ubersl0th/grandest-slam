import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason : null;

  const supabase = await createClient();
  // Auth + admin check happens via the SECURITY DEFINER RPC, which calls is_admin().
  const { error } = await supabase.rpc("reject_team_submission", {
    p_submission_id: id,
    p_reason: reason,
  });
  if (error) {
    return NextResponse.json({ error: "reject", message: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
