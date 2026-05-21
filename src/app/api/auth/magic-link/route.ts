import { NextResponse } from "next/server";
import { originFrom, sendMagicLink } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
	const body = await req.json().catch(() => null);
	const rawEmail =
		body && typeof body.email === "string" ? body.email : undefined;
	const rawNext = body && typeof body.next === "string" ? body.next : undefined;
	if (!rawEmail) {
		return NextResponse.json(
			{ error: "validation", message: "E-post mangler." },
			{ status: 400 },
		);
	}
	const email = rawEmail.trim().toLowerCase();
	const next = rawNext?.startsWith("/") ? rawNext : "/dashboard";

	const admin = createServiceClient();
	const origin = originFrom(req);
	const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

	const link = await admin.auth.admin.generateLink({
		type: "magiclink",
		email,
		options: { redirectTo },
	});

	// Don't leak whether the email is registered — always respond OK from the
	// caller's perspective. Skip sending when no user exists.
	if (link.error || !link.data.properties?.action_link) {
		return NextResponse.json({ ok: true });
	}
	const magicUrl = link.data.properties.action_link;

	// Greet by first name when we have a profile for them.
	const userId = link.data.user?.id;
	let firstName = "";
	if (userId) {
		const { data: profile } = await admin
			.from("profiles")
			.select("first_name")
			.eq("id", userId)
			.maybeSingle();
		firstName =
			(profile as { first_name?: string | null } | null)?.first_name ?? "";
	}

	await sendMagicLink({
		kind: "signin",
		to: email,
		name: firstName,
		magicUrl,
	});

	return NextResponse.json({ ok: true });
}
