import { render } from "@react-email/render";
import nodemailer, { type Transporter } from "nodemailer";
import { createElement, type ReactElement } from "react";
import { Resend } from "resend";
import {
	AdminNotifyEmail,
	type AdminNotifyKind,
	adminSubjectFor,
} from "@/emails/AdminNotifyEmail";
import {
	MagicLinkEmail,
	type MagicLinkKind,
	subjectFor,
} from "@/emails/MagicLinkEmail";
import {
	SubmissionStatusEmail,
	type SubmissionStatusKind,
	statusSubjectFor,
} from "@/emails/SubmissionStatusEmail";
import type { ExperienceLevel, Sport } from "@/lib/database.types";
import { experienceLabel, SPORTS, sportLabel } from "@/lib/sports";
import { createServiceClient } from "@/lib/supabase/server";

const FROM = `The Grandest Slam <${process.env.EMAIL_FROM ?? "team@mail.thegrandestslam.no"}>`;

// Dev environments route mail to the Mailpit instance bundled with
// `supabase start` (web UI: http://127.0.0.1:54324). Prod always goes to Resend.
const USE_SMTP = process.env.NODE_ENV !== "production";

type SendArgs = {
	to: string | string[];
	subject: string;
	react: ReactElement;
};

async function send(args: SendArgs, label: string): Promise<void> {
	if (USE_SMTP) {
		const html = await render(args.react);
		const text = await render(args.react, { plainText: true });
		await smtp().sendMail({
			from: FROM,
			to: args.to,
			subject: args.subject,
			html,
			text,
		});
		return;
	}
	const { error } = await resend().emails.send({
		from: FROM,
		to: args.to,
		subject: args.subject,
		react: args.react,
	});
	if (error) throw new Error(`Resend (${label}): ${error.message}`);
}

let cachedResend: Resend | null = null;
function resend(): Resend {
	if (cachedResend) return cachedResend;
	const key = process.env.RESEND_API_KEY;
	if (!key) throw new Error("RESEND_API_KEY is not configured");
	cachedResend = new Resend(key);
	return cachedResend;
}

let cachedSmtp: Transporter | null = null;
function smtp(): Transporter {
	if (cachedSmtp) return cachedSmtp;
	cachedSmtp = nodemailer.createTransport({
		host: "127.0.0.1",
		port: 54325,
		secure: false,
	});
	return cachedSmtp;
}

export async function sendMagicLink(opts: {
	kind: MagicLinkKind;
	to: string;
	name: string;
	magicUrl: string;
	teamName?: string;
	partnerName?: string;
	partnerSkill?: string;
}): Promise<void> {
	await send(
		{
			to: opts.to,
			subject: subjectFor(opts.kind),
			react: createElement(MagicLinkEmail, {
				kind: opts.kind,
				name: opts.name,
				magicUrl: opts.magicUrl,
				teamName: opts.teamName,
				partnerName: opts.partnerName,
				partnerSkill: opts.partnerSkill,
			}),
		},
		`magic-link/${opts.kind}`,
	);
}

export async function sendSubmissionStatus(opts: {
	kind: SubmissionStatusKind;
	to: string;
	name: string;
	teamName?: string;
	partnerName?: string;
	reason?: string | null;
}): Promise<void> {
	await send(
		{
			to: opts.to,
			subject: statusSubjectFor(opts.kind, { teamName: opts.teamName }),
			react: createElement(SubmissionStatusEmail, {
				kind: opts.kind,
				name: opts.name,
				teamName: opts.teamName,
				partnerName: opts.partnerName,
				reason: opts.reason,
			}),
		},
		`submission-status/${opts.kind}`,
	);
}

export async function sendAdminNotify(opts: {
	kind: AdminNotifyKind;
	name: string;
	email: string;
	skill: string;
	signedUpAt: string;
	adminUrl: string;
	teamName?: string;
	partnerName?: string;
	partnerEmail?: string;
	partnerSkill?: string;
}): Promise<void> {
	const recipients = await getAdminEmails();
	if (recipients.length === 0) {
		// No organisers in the system means nobody to notify. Better to fail loudly so
		// signups don't silently bypass admin review.
		throw new Error("No admin recipients found in profiles");
	}
	await send(
		{
			to: recipients,
			subject: adminSubjectFor(opts),
			react: createElement(AdminNotifyEmail, opts),
		},
		`admin-notify/${opts.kind}`,
	);
}

async function getAdminEmails(): Promise<string[]> {
	const admin = createServiceClient();
	const { data, error } = await admin
		.from("profiles")
		.select("id, email")
		.in("role", ["admin", "super_admin"]);
	if (error) throw new Error(`Admin lookup failed: ${error.message}`);
	const fromProfiles = (data ?? [])
		.map((row) => (row as { email: string | null }).email)
		.filter((e): e is string => typeof e === "string" && e.length > 0);
	if (fromProfiles.length > 0) return fromProfiles;

	// Fallback: profiles may not have email mirrored from auth.users. Pull from
	// auth admin API using the ids we found.
	const ids = (data ?? []).map((row) => (row as { id: string }).id);
	if (ids.length === 0) return [];
	const idSet = new Set(ids);
	const out: string[] = [];
	const { data: list, error: listErr } = await admin.auth.admin.listUsers({
		page: 1,
		perPage: 200,
	});
	if (listErr) throw new Error(`Auth lookup failed: ${listErr.message}`);
	for (const u of list?.users ?? []) {
		if (idSet.has(u.id) && u.email) out.push(u.email);
	}
	return out;
}

/** Build "Padel: Avansert · Tennis: Middels · …" from an experience map. */
export function formatSkillSummary(
	experience: Record<Sport, ExperienceLevel> | null | undefined,
): string {
	if (!experience) return "—";
	return SPORTS.map(
		(s) => `${sportLabel(s.key)}: ${experienceLabel(experience[s.key])}`,
	).join(" · ");
}

/** Norwegian timestamp like "21. mai 2026 · 14:32". */
export function formatSignedUpAt(iso?: string | null): string {
	const d = iso ? new Date(iso) : new Date();
	const date = new Intl.DateTimeFormat("nb-NO", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "Europe/Oslo",
	}).format(d);
	const time = new Intl.DateTimeFormat("nb-NO", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Europe/Oslo",
	}).format(d);
	return `${date} · ${time}`;
}

/** Origin to embed in outbound links. Falls back to APP_URL env. */
export function originFrom(req: Request): string {
	const env = process.env.NEXT_PUBLIC_APP_URL;
	if (env) return env.replace(/\/$/, "");
	return new URL(req.url).origin;
}
