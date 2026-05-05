import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { teamSubmissionSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
	const json = await req.json().catch(() => null);
	const parsed = teamSubmissionSchema.safeParse(json);
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
		player_1_first_name: data.player_1.first_name,
		player_1_last_name: data.player_1.last_name,
		player_1_nickname: data.player_1.nickname || null,
		player_1_email: data.player_1.email,
		player_1_bio: data.player_1.bio || null,
		player_1_experience: data.player_1.experience,
		player_2_first_name: data.player_2.first_name,
		player_2_last_name: data.player_2.last_name,
		player_2_nickname: data.player_2.nickname || null,
		player_2_email: data.player_2.email,
		player_2_bio: data.player_2.bio || null,
		player_2_experience: data.player_2.experience,
	});

	if (error) {
		if (error.code === "23505") {
			return NextResponse.json(
				{
					error: "duplicate_pending",
					message:
						"Det finnes allerede en avventende påmelding med dette lagnavnet.",
				},
				{ status: 409 },
			);
		}
		if (error.code === "23514") {
			return NextResponse.json(
				{
					error: "same_emails",
					message: "Spillerne må ha forskjellige e-postadresser.",
				},
				{ status: 400 },
			);
		}
		return NextResponse.json(
			{ error: "submission_insert", message: error.message },
			{ status: 500 },
		);
	}

	return NextResponse.json({ ok: true });
}
