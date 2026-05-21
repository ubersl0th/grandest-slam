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

	// Read both players' contact info before the RPC so we can email them.
	const { data: submission, error: readErr } = await supabase
		.from("team_submissions")
		.select(
			"team_name, player_1_first_name, player_1_last_name, player_1_email, player_2_first_name, player_2_last_name, player_2_email",
		)
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
	const sub = submission as {
		team_name: string;
		player_1_first_name: string;
		player_1_last_name: string;
		player_1_email: string;
		player_2_first_name: string;
		player_2_last_name: string;
		player_2_email: string;
	};

	const { error } = await supabase.rpc("reject_team_submission", {
		p_submission_id: id,
		p_reason: reason,
	});
	if (error) {
		return NextResponse.json(
			{ error: "reject", message: error.message },
			{ status: 400 },
		);
	}

	const p1Full = `${sub.player_1_first_name} ${sub.player_1_last_name}`.trim();
	const p2Full = `${sub.player_2_first_name} ${sub.player_2_last_name}`.trim();
	await sendSubmissionStatus({
		kind: "rejected-team",
		to: sub.player_1_email,
		name: sub.player_1_first_name,
		teamName: sub.team_name,
		partnerName: p2Full,
		reason,
	});
	await sendSubmissionStatus({
		kind: "rejected-team",
		to: sub.player_2_email,
		name: sub.player_2_first_name,
		teamName: sub.team_name,
		partnerName: p1Full,
		reason,
	});

	return NextResponse.json({ ok: true });
}
