// React Email component for The Grandest Slam magic-link emails.
// Install:  npm i resend @react-email/components
//
// Usage:
//   import { Resend } from 'resend';
//   import { MagicLinkEmail } from './MagicLinkEmail';
//   const resend = new Resend(process.env.RESEND_API_KEY!);
//   await resend.emails.send({
//     from: 'The Grandest Slam <noreply@thegrandestslam.no>',
//     to: user.email,
//     subject: subjectFor(kind),
//     react: <MagicLinkEmail kind="signin" name="Ola" magicUrl={url} />,
//   });

import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type * as React from "react";

export type MagicLinkKind =
	| "signin"
	| "approved"
	| "approved-team"
	| "team-assigned";

export interface MagicLinkEmailProps {
	kind: MagicLinkKind;
	name: string;
	magicUrl: string;
	/** Required for kind="team-signup" — the name the pair chose at signup. */
	teamName?: string;
	partnerName?: string;
	/** Used by kind="team-assigned" only. */
	partnerSkill?: string;
	/** Public, hot-linkable URL for the emblem logo. Host on your own CDN for production. */
	logoUrl?: string;
}

const ink = "#1a1410";
const cream = "#f7ecd2";
const cream50 = "#fbf6e8";
const terracotta = "#d2502d";
const teal = "#2f7e7a";
const mustard = "#e8a838";
const plum = "#6b3464";

const fontDisplay = '"Bowlby One","Arial Black",system-ui,sans-serif';
const fontSans = '"Inter",system-ui,-apple-system,Arial,sans-serif';

const COPY: Record<
	MagicLinkKind,
	{
		preview: string;
		tagText: string;
		tagBg: string;
		tagFg: string;
		heading: (p: MagicLinkEmailProps) => React.ReactNode;
		body: (p: MagicLinkEmailProps) => React.ReactNode;
		cta: string;
	}
> = {
	signin: {
		preview:
			"Trykk på lenken for å logge inn på The Grandest Slam. Lenken utløper om 15 minutter.",
		tagText: "Magisk lenke",
		tagBg: mustard,
		tagFg: ink,
		heading: () => (
			<>
				Velkommen <span style={{ color: terracotta }}>tilbake</span>.
			</>
		),
		body: () =>
			"Trykk på knappen under for å logge inn. Lenken er gyldig i 15 minutter — etter det må du be om en ny.",
		cta: "Logg inn →",
	},
	approved: {
		preview: "Påmeldingen er godkjent — trykk for å logge inn.",
		tagText: "Godkjent",
		tagBg: teal,
		tagFg: cream50,
		heading: () => (
			<>
				Du er <span style={{ color: teal }}>inne</span>.
			</>
		),
		body: () =>
			"En organisator har godkjent påmeldingen din. Trykk under for å logge inn. Vi setter deg på et lag så snart vi har en god makker til deg — du får beskjed her når det er gjort.",
		cta: "Logg inn →",
	},
	"approved-team": {
		preview: "Laget er godkjent — trykk for å logge inn.",
		tagText: "Lag godkjent",
		tagBg: plum,
		tagFg: cream50,
		heading: (p) => (
			<>
				<span style={{ color: plum }}>{p.teamName ?? "…"}</span> er godkjent.
			</>
		),
		body: (p) => (
			<>
				Laget <strong>{p.teamName ?? "…"}</strong> ({p.name} +{" "}
				{p.partnerName ?? "…"}) er godkjent og offisielt med. Trykk under for å
				logge inn og se hva som skjer videre.
			</>
		),
		cta: "Logg inn →",
	},
	"team-assigned": {
		preview: "Du har fått makker. Trykk for å se kampoppsettet.",
		tagText: "Laget ditt er klart",
		tagBg: terracotta,
		tagFg: cream50,
		heading: () => (
			<>
				Laget <span style={{ color: terracotta }}>ditt</span> er klart.
			</>
		),
		body: (p) => (
			<>
				Hei {p.name} — du er paret med <strong>{p.partnerName ?? "…"}</strong>
				{p.partnerSkill ? <> ({p.partnerSkill})</> : null}. Trykk under for å se
				kampoppsettet og bekrefte at dere er klare for helgen.
			</>
		),
		cta: "Se kampoppsettet →",
	},
};

export const MagicLinkEmail: React.FC<MagicLinkEmailProps> = ({
	kind,
	name,
	magicUrl,
	teamName,
	partnerName,
	partnerSkill,
	logoUrl = "https://www.thegrandestslam.no/The_Grandest_Slam.webp",
}) => {
	const c = COPY[kind];
	const props: MagicLinkEmailProps = {
		kind,
		name,
		magicUrl,
		teamName,
		partnerName,
		partnerSkill,
	};
	return (
		<Html lang="no">
			<Head>
				<meta name="color-scheme" content="light only" />
				<meta name="supported-color-schemes" content="light" />
				<link
					rel="stylesheet"
					href="https://fonts.googleapis.com/css2?family=Bowlby+One&family=Inter:wght@400;600;700;800&display=swap"
				/>
			</Head>
			<Preview>{c.preview}</Preview>
			<Body
				style={{
					margin: 0,
					padding: 0,
					background: cream,
					fontFamily: fontSans,
					color: ink,
				}}
			>
				<Container
					style={{
						width: "100%",
						maxWidth: 560,
						margin: "0 auto",
						padding: "32px 16px",
					}}
				>
					{/* Wordmark */}
					<Section style={{ textAlign: "center", paddingBottom: 24 }}>
						<table
							role="presentation"
							cellPadding={0}
							cellSpacing={0}
							style={{ margin: "0 auto" }}
						>
							<tbody>
								<tr>
									<td style={{ paddingRight: 10, verticalAlign: "middle" }}>
										<Img
											src={logoUrl}
											alt=""
											width={44}
											height={44}
											style={{
												display: "block",
												width: 44,
												height: 44,
												borderRadius: 9999,
												border: `2px solid ${ink}`,
												background: mustard,
											}}
										/>
									</td>
									<td style={{ verticalAlign: "middle" }}>
										<span
											style={{
												fontFamily: fontDisplay,
												color: ink,
												fontSize: 18,
												letterSpacing: "0.08em",
											}}
										>
											THE GRANDEST SLAM
										</span>
									</td>
								</tr>
							</tbody>
						</table>
					</Section>

					{/* Card */}
					<Section
						style={{
							background: cream50,
							border: `2px solid ${ink}`,
							borderRadius: 20,
							boxShadow: `6px 6px 0 ${ink}`,
							padding: "36px 36px 32px",
						}}
					>
						<div style={{ marginBottom: 20 }}>
							<span
								style={{
									display: "inline-block",
									padding: "6px 12px",
									background: c.tagBg,
									color: c.tagFg,
									fontFamily: fontSans,
									fontWeight: 700,
									fontSize: 12,
									letterSpacing: "0.08em",
									textTransform: "uppercase",
									border: `2px solid ${ink}`,
									borderRadius: 9999,
								}}
							>
								{c.tagText}
							</span>
						</div>

						<Heading
							as="h1"
							style={{
								margin: "0 0 16px",
								fontFamily: fontDisplay,
								fontWeight: 400,
								fontSize: 54,
								lineHeight: 0.9,
								letterSpacing: "-0.01em",
								color: ink,
							}}
						>
							{c.heading(props)}
						</Heading>

						<Text
							style={{
								margin: "0 0 28px",
								fontSize: 16,
								lineHeight: 1.55,
								color: ink,
							}}
						>
							{c.body(props)}
						</Text>

						<Button
							href={magicUrl}
							style={{
								display: "inline-block",
								padding: "16px 28px",
								background: terracotta,
								color: cream50,
								fontFamily: fontSans,
								fontWeight: 700,
								fontSize: 16,
								letterSpacing: "0.02em",
								border: `2px solid ${ink}`,
								borderRadius: 9999,
								boxShadow: `4px 4px 0 ${ink}`,
								textDecoration: "none",
							}}
						>
							{c.cta}
						</Button>

						<Text
							style={{
								margin: "24px 0 0",
								fontSize: 13,
								lineHeight: 1.5,
								color: "rgba(26,20,16,0.7)",
							}}
						>
							Hvis knappen ikke virker, lim denne lenken inn i nettleseren:
							<br />
							<Link
								href={magicUrl}
								style={{
									color: teal,
									wordBreak: "break-all",
									textDecoration: "underline",
								}}
							>
								{magicUrl}
							</Link>
						</Text>
					</Section>

					{/* Sport strip */}
					<Section style={{ textAlign: "center", paddingTop: 28 }}>
						<span
							style={{
								fontFamily: fontDisplay,
								fontSize: 14,
								letterSpacing: "0.18em",
								color: ink,
							}}
						>
							★&nbsp;PADEL&nbsp;&nbsp;★&nbsp;TENNIS&nbsp;&nbsp;★&nbsp;FRISBEEGOLF&nbsp;&nbsp;★&nbsp;GOLF
						</span>
					</Section>

					{/* Footer */}
					<Section style={{ padding: "28px 0 8px", textAlign: "center" }}>
						<Text
							style={{
								margin: "0 0 12px",
								fontSize: 13,
								lineHeight: 1.55,
								color: "rgba(26,20,16,0.7)",
							}}
						>
							<Link
								href="https://www.thegrandestslam.no/leaderboard"
								style={{
									color: ink,
									fontWeight: 700,
									textDecoration: "underline",
								}}
							>
								Live resultatliste →
							</Link>
						</Text>
						<Text
							style={{
								margin: 0,
								fontSize: 12,
								lineHeight: 1.55,
								color: "rgba(26,20,16,0.55)",
							}}
						>
							Ved å delta samtykker du i å spille hardt, tape verdig og bekrefte
							motstandernes poeng ærlig.
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
};

export default MagicLinkEmail;

// Helper: Norwegian subject line per flow
export function subjectFor(kind: MagicLinkKind): string {
	switch (kind) {
		case "signin":
			return "Velkommen tilbake til slammet — trykk her ↓";
		case "approved":
			return "Du er godkjent — logg inn for å komme i gang ↓";
		case "approved-team":
			return "Laget er godkjent — logg inn for å komme i gang ↓";
		case "team-assigned":
			return "Laget ditt er klart — møt makkeren din ↓";
	}
}
