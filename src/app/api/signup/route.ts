import { NextResponse } from "next/server";
import {
	formatSignedUpAt,
	formatSkillSummary,
	originFrom,
	sendAdminNotify,
	sendSubmissionStatus,
} from "@/lib/email";
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
		avatar_url: data.avatar_url || null,
		experience: data.experience,
	});

	if (error) {
		if (error.code === "23505") {
			return NextResponse.json(
				{
					error: "duplicate_pending",
					message:
						"Det finnes allerede en avventende påmelding for denne e-postadressen.",
				},
				{ status: 409 },
			);
		}
		return NextResponse.json(
			{ error: "submission_insert", message: error.message },
			{ status: 500 },
		);
	}

	const origin = originFrom(req);
	await sendSubmissionStatus({
		kind: "received-solo",
		to: data.email,
		name: data.first_name,
	});
	await sendAdminNotify({
		kind: "solo",
		name: `${data.first_name} ${data.last_name}`.trim(),
		email: data.email,
		skill: formatSkillSummary(data.experience),
		signedUpAt: formatSignedUpAt(),
		adminUrl: `${origin}/admin`,
	});

	return NextResponse.json({ ok: true });
}
