import { NextResponse } from "next/server";
import { sendSubmissionStatus } from "@/lib/email";
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

	// Read the submission first so we know who to email after the RPC. The RPC is
	// security-definer; if the caller isn't an admin the .select() returns null
	// via RLS and we bail.
	const { data: submission, error: readErr } = await supabase
		.from("player_submissions")
		.select("email, first_name")
		.eq("id", id)
		.maybeSingle();
	if (readErr) {
		return NextResponse.json(
			{ error: "submission_read", message: readErr.message },
			{ status: 500 },
		);
	}
	if (!submission) {
		return NextResponse.json({ error: "not_found" }, { status: 404 });
	}
	const sub = submission as { email: string; first_name: string };

	const { error } = await supabase.rpc("reject_player_submission", {
		p_submission_id: id,
		p_reason: reason,
	});
	if (error) {
		return NextResponse.json(
			{ error: "reject", message: error.message },
			{ status: 400 },
		);
	}

	await sendSubmissionStatus({
		kind: "rejected-solo",
		to: sub.email,
		name: sub.first_name,
		reason,
	});

	return NextResponse.json({ ok: true });
}
