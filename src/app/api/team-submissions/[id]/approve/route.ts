import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/auth";
import type { ExperienceLevel, Sport } from "@/lib/database.types";
import { originFrom, sendMagicLink } from "@/lib/email";
import { SPORTS } from "@/lib/sports";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ExperienceMap = Record<Sport, ExperienceLevel>;

type SubmissionRow = {
	id: string;
	status: "pending" | "approved" | "rejected";
	team_name: string;
	team_bio: string | null;
	team_avatar_url: string | null;
	player_1_first_name: string;
	player_1_last_name: string;
	player_1_nickname: string | null;
	player_1_email: string;
	player_1_bio: string | null;
	player_1_avatar_url: string | null;
	player_1_experience: unknown;
	player_2_first_name: string;
	player_2_last_name: string;
	player_2_nickname: string | null;
	player_2_email: string;
	player_2_bio: string | null;
	player_2_avatar_url: string | null;
	player_2_experience: unknown;
};

type PlayerInput = {
	first_name: string;
	last_name: string;
	nickname: string | null;
	email: string;
	bio: string | null;
	avatar_url: string | null;
	experience: ExperienceMap;
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
	if (
		!isAdminRole((callerProfile as { role?: string } | null)?.role as never)
	) {
		return NextResponse.json({ error: "forbidden" }, { status: 403 });
	}

	// 2. Read submission via the admin's session (RLS allows admins to read).
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
			{
				error: "already_reviewed",
				message: `Påmeldingen er allerede ${sub.status === "approved" ? "godkjent" : "avvist"}.`,
			},
			{ status: 409 },
		);
	}

	// 3. Make sure the team name isn't taken before we start inviting users.
	const { data: existingTeam } = await supabase
		.from("teams")
		.select("id")
		.ilike("name", sub.team_name)
		.maybeSingle();
	if (existingTeam) {
		return NextResponse.json(
			{
				error: "team_name_taken",
				message: `Lagnavnet «${sub.team_name}» er allerede i bruk.`,
			},
			{ status: 409 },
		);
	}

	const players: PlayerInput[] = [
		{
			first_name: sub.player_1_first_name,
			last_name: sub.player_1_last_name,
			nickname: sub.player_1_nickname,
			email: sub.player_1_email.toLowerCase(),
			bio: sub.player_1_bio,
			avatar_url: sub.player_1_avatar_url,
			experience: sub.player_1_experience as ExperienceMap,
		},
		{
			first_name: sub.player_2_first_name,
			last_name: sub.player_2_last_name,
			nickname: sub.player_2_nickname,
			email: sub.player_2_email.toLowerCase(),
			bio: sub.player_2_bio,
			avatar_url: sub.player_2_avatar_url,
			experience: sub.player_2_experience as ExperienceMap,
		},
	];

	// 4. Create/look up both auth users and capture the magic link URLs
	//    without letting Supabase send its own email — we send custom Resend
	//    emails at the end of the flow.
	const adminAuth = createServiceClient();
	const origin = originFrom(req);
	const redirectTo = `${origin}/auth/callback?next=/dashboard`;
	const userIds: string[] = [];
	const magicUrls: string[] = [];

	for (const p of players) {
		let userId: string | undefined;
		let magicUrl: string | undefined;

		const invite = await adminAuth.auth.admin.generateLink({
			type: "invite",
			email: p.email,
			options: {
				data: {
					first_name: p.first_name,
					last_name: p.last_name,
					nickname: p.nickname ?? "",
					bio: p.bio ?? "",
				},
				redirectTo,
			},
		});
		if (!invite.error) {
			userId = invite.data.user?.id;
			magicUrl = invite.data.properties?.action_link;
		} else {
			const link = await adminAuth.auth.admin.generateLink({
				type: "magiclink",
				email: p.email,
				options: { redirectTo },
			});
			if (link.error) {
				return NextResponse.json(
					{ error: "auth_invite", message: link.error.message },
					{ status: 500 },
				);
			}
			userId = link.data.user?.id;
			magicUrl = link.data.properties?.action_link;
		}
		if (!userId || !magicUrl) {
			return NextResponse.json(
				{
					error: "auth_invite_no_user",
					message: "Autentiseringsleverandøren returnerte ingen bruker.",
				},
				{ status: 500 },
			);
		}
		userIds.push(userId);
		magicUrls.push(magicUrl);
	}

	// 5. Refresh profile fields (the trigger may have already created them
	//    with this metadata, but admin re-invites won't update existing rows).
	for (let i = 0; i < players.length; i++) {
		const p = players[i];
		const userId = userIds[i];
		const { error: profileErr } = await supabase
			.from("profiles")
			.update({
				first_name: p.first_name,
				last_name: p.last_name,
				nickname: p.nickname,
				bio: p.bio,
				avatar_url: p.avatar_url,
			})
			.eq("id", userId);
		if (profileErr) {
			return NextResponse.json(
				{ error: "profile_update", message: profileErr.message },
				{ status: 500 },
			);
		}
	}

	// 6. Save experience levels for both players.
	const expRows = players.flatMap((p, i) =>
		SPORTS.map((s) => ({
			profile_id: userIds[i],
			sport: s.key,
			level: p.experience[s.key],
		})),
	);
	const { error: expErr } = await supabase
		.from("player_experience")
		.upsert(expRows, { onConflict: "profile_id,sport" });
	if (expErr) {
		return NextResponse.json(
			{ error: "experience", message: expErr.message },
			{ status: 500 },
		);
	}

	// 7. Each player can only belong to one team — bail out early if either
	//    is already assigned (existing user re-invited mid-tournament).
	const { data: existingMembership } = await supabase
		.from("team_members")
		.select("profile_id, team_id")
		.in("profile_id", userIds);
	if (existingMembership && existingMembership.length > 0) {
		return NextResponse.json(
			{
				error: "player_on_team",
				message:
					"En av spillerne er allerede med på et lag. Fjern dem først for å godkjenne denne påmeldingen.",
			},
			{ status: 409 },
		);
	}

	// 8. Create the team and add both members.
	const { data: team, error: teamErr } = await supabase
		.from("teams")
		.insert({
			name: sub.team_name,
			bio: sub.team_bio,
			avatar_url: sub.team_avatar_url,
		})
		.select()
		.single();
	if (teamErr || !team) {
		return NextResponse.json(
			{
				error: "team_create",
				message: teamErr?.message ?? "Lag ikke opprettet.",
			},
			{ status: 500 },
		);
	}
	const teamRow = team as { id: string };
	const { error: memberErr } = await supabase.from("team_members").insert([
		{ team_id: teamRow.id, profile_id: userIds[0] },
		{ team_id: teamRow.id, profile_id: userIds[1] },
	]);
	if (memberErr) {
		return NextResponse.json(
			{ error: "team_members", message: memberErr.message },
			{ status: 500 },
		);
	}

	// 9. Mark the submission approved.
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
			{
				error: "submission_update",
				message: updateErr.message,
				team_id: teamRow.id,
			},
			{ status: 500 },
		);
	}

	// 10. Send the custom approval emails — each player gets their own magic link.
	const fullNames = players.map((p) => `${p.first_name} ${p.last_name}`.trim());
	await sendMagicLink({
		kind: "approved-team",
		to: players[0].email,
		name: players[0].first_name,
		magicUrl: magicUrls[0],
		teamName: sub.team_name,
		partnerName: fullNames[1],
	});
	await sendMagicLink({
		kind: "approved-team",
		to: players[1].email,
		name: players[1].first_name,
		magicUrl: magicUrls[1],
		teamName: sub.team_name,
		partnerName: fullNames[0],
	});

	return NextResponse.json({ ok: true, team_id: teamRow.id });
}
