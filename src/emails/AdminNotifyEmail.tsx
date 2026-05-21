// React Email component for admin notifications when a new player or team signs up.
// Sent to organisers, not the player. Has two variants: 'solo' and 'team'.
//
// Usage:
//   await resend.emails.send({
//     from: 'The Grandest Slam <noreply@thegrandestslam.no>',
//     to: ADMIN_RECIPIENTS,
//     subject: adminSubjectFor(payload),
//     react: <AdminNotifyEmail kind="team" {...payload} />,
//   });

import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type * as React from "react";

export type AdminNotifyKind = "solo" | "team";

export interface AdminNotifyEmailProps {
	kind: AdminNotifyKind;
	/** Primary signup (the user who submitted the form). */
	name: string;
	email: string;
	skill: string;
	signedUpAt: string; // e.g. "21. mai 2026 · 14:32"
	adminUrl: string; // direct link to this signup in the admin panel

	/** Required when kind === 'team'. */
	teamName?: string;
	partnerName?: string;
	partnerEmail?: string;
	partnerSkill?: string;

	logoUrl?: string;
}

const ink = "#1a1410";
const cream = "#f7ecd2";
const cream50 = "#fbf6e8";
const cream200 = "#efddb1";
const terracotta = "#d2502d";
const teal = "#2f7e7a";
const mustard = "#e8a838";
const plum = "#6b3464";

const fontDisplay = '"Bowlby One","Arial Black",system-ui,sans-serif';
const fontSans = '"Inter",system-ui,-apple-system,Arial,sans-serif';

const hairline = "rgba(26,20,16,0.18)";
const muted = "rgba(26,20,16,0.7)";

const DataRow: React.FC<{
	label: string;
	children: React.ReactNode;
	first?: boolean;
}> = ({ label, children, first }) => (
	<tr>
		<td
			style={{
				padding: "10px 18px",
				fontSize: 13,
				color: muted,
				verticalAlign: "top",
				borderTop: first ? "none" : `1px solid ${hairline}`,
				width: "35%",
			}}
		>
			{label}
		</td>
		<td
			style={{
				padding: "10px 18px",
				fontSize: 15,
				color: ink,
				borderTop: first ? "none" : `1px solid ${hairline}`,
			}}
		>
			{children}
		</td>
	</tr>
);

const SectionHeader: React.FC<{
	children: React.ReactNode;
	tinted?: boolean;
	topBorder?: boolean;
}> = ({ children, tinted, topBorder }) => (
	<tr>
		<td
			colSpan={2}
			style={{
				padding: "14px 18px 10px",
				borderBottom: `1px solid ${hairline}`,
				borderTop: topBorder ? `2px solid ${ink}` : "none",
				background: tinted ? cream200 : "transparent",
			}}
		>
			<span
				style={{
					fontFamily: fontDisplay,
					fontSize: 13,
					letterSpacing: "0.14em",
					color: ink,
				}}
			>
				{children}
			</span>
		</td>
	</tr>
);

export const AdminNotifyEmail: React.FC<AdminNotifyEmailProps> = ({
	kind,
	name,
	email,
	skill,
	signedUpAt,
	adminUrl,
	teamName,
	partnerName,
	partnerEmail,
	partnerSkill,
	logoUrl = "https://www.thegrandestslam.no/The_Grandest_Slam.webp",
}) => {
	const isTeam = kind === "team";
	const heroAccent = isTeam ? plum : teal;
	const hero = isTeam ? (teamName ?? "…") : name;
	const preview = isTeam
		? `Nytt lag (${teamName ?? "…"}) venter på godkjenning.`
		: `Ny solo-spiller (${name}) venter på godkjenning.`;

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
			<Preview>{preview}</Preview>
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
						{/* Ink-on-cream tag signals internal */}
						<div style={{ marginBottom: 20 }}>
							<span
								style={{
									display: "inline-block",
									padding: "6px 12px",
									background: ink,
									color: cream50,
									fontFamily: fontSans,
									fontWeight: 700,
									fontSize: 12,
									letterSpacing: "0.08em",
									textTransform: "uppercase",
									border: `2px solid ${ink}`,
									borderRadius: 9999,
								}}
							>
								Ny påmelding · {isTeam ? "Lag" : "Solo"}
							</span>
						</div>

						<Heading
							as="h1"
							style={{
								margin: "0 0 16px",
								fontFamily: fontDisplay,
								fontWeight: 400,
								fontSize: 48,
								lineHeight: 0.9,
								letterSpacing: "-0.01em",
								color: ink,
							}}
						>
							<span style={{ color: heroAccent }}>{hero}</span> venter på
							godkjenning.
						</Heading>

						<Text
							style={{
								margin: "0 0 24px",
								fontSize: 16,
								lineHeight: 1.55,
								color: "rgba(26,20,16,0.85)",
							}}
						>
							{isTeam
								? "Et nytt lag har meldt seg på. Begge spillerne må bekrefte e-postene sine før dere kan godkjenne. Vurder under, eller åpne admin-panelet for full kontekst."
								: "En ny solo-spiller har meldt seg på og bekreftet e-posten. Vurder under, eller åpne admin-panelet for full kontekst."}
						</Text>

						{/* Data block */}
						<table
							role="presentation"
							width="100%"
							cellPadding={0}
							cellSpacing={0}
							style={{
								margin: "0 0 28px",
								border: `2px solid ${ink}`,
								borderRadius: 12,
								background: cream,
							}}
						>
							<tbody>
								{isTeam ? (
									<>
										<SectionHeader>LAG</SectionHeader>
										<DataRow label="Lagnavn" first>
											<strong>{teamName}</strong>
										</DataRow>
										<DataRow label="Meldt på">{signedUpAt}</DataRow>

										<SectionHeader tinted topBorder>
											SPILLER 1
										</SectionHeader>
										<DataRow label="Navn" first>
											<strong>{name}</strong>
										</DataRow>
										<DataRow label="E-post">
											<Link
												href={`mailto:${email}`}
												style={{ color: teal, textDecoration: "underline" }}
											>
												{email}
											</Link>
										</DataRow>
										<DataRow label="Nivå">{skill}</DataRow>

										<SectionHeader tinted topBorder>
											SPILLER 2
										</SectionHeader>
										<DataRow label="Navn" first>
											<strong>{partnerName}</strong>
										</DataRow>
										<DataRow label="E-post">
											<Link
												href={`mailto:${partnerEmail}`}
												style={{ color: teal, textDecoration: "underline" }}
											>
												{partnerEmail}
											</Link>
										</DataRow>
										<DataRow label="Nivå">{partnerSkill}</DataRow>
									</>
								) : (
									<>
										<SectionHeader>SPILLER</SectionHeader>
										<DataRow label="Navn" first>
											<strong>{name}</strong>
										</DataRow>
										<DataRow label="E-post">
											<Link
												href={`mailto:${email}`}
												style={{ color: teal, textDecoration: "underline" }}
											>
												{email}
											</Link>
										</DataRow>
										<DataRow label="Nivå">{skill}</DataRow>
										<DataRow label="Meldt på">{signedUpAt}</DataRow>
									</>
								)}
							</tbody>
						</table>

						<Button
							href={adminUrl}
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
							Vurder påmelding →
						</Button>

						<Text
							style={{
								margin: "24px 0 0",
								fontSize: 13,
								lineHeight: 1.5,
								color: muted,
							}}
						>
							Hvis knappen ikke virker, lim denne lenken inn i nettleseren:
							<br />
							<Link
								href={adminUrl}
								style={{
									color: teal,
									wordBreak: "break-all",
									textDecoration: "underline",
								}}
							>
								{adminUrl}
							</Link>
						</Text>
					</Section>

					{/* Footer */}
					<Section style={{ padding: "28px 0 8px", textAlign: "center" }}>
						<Text
							style={{
								margin: 0,
								fontSize: 12,
								lineHeight: 1.55,
								color: "rgba(26,20,16,0.55)",
							}}
						>
							Sendt automatisk til organisatorene · The Grandest Slam
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
};

export default AdminNotifyEmail;

// Helper: Norwegian subject line per kind
export function adminSubjectFor(p: {
	kind: AdminNotifyKind;
	name: string;
	teamName?: string;
}): string {
	return p.kind === "team"
		? `Nytt lag på venteliste: ${p.teamName ?? "—"}`
		: `Ny spiller på venteliste: ${p.name}`;
}
