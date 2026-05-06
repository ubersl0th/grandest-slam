import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type { Sport, SubmissionStatus } from "@/lib/database.types";
import { sportEmoji, sportLabel } from "@/lib/sports";

const dateFmt = new Intl.DateTimeFormat("nb-NO", {
	day: "numeric",
	month: "short",
	hour: "2-digit",
	minute: "2-digit",
});

function formatRegistered(iso: string | null): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return dateFmt.format(d);
}

export type MatchCardSide = {
	name: string;
	avatarUrl?: string | null;
	score: number | null;
	won: boolean;
	lost: boolean;
	isMine?: boolean;
};

export type MatchCardCta = {
	label: string;
	tone?: "primary" | "default";
};

export type MatchCardProps = {
	href: string;
	sport: Sport;
	round?: number;
	status: SubmissionStatus | null;
	submittedAt?: string | null;
	teamA: MatchCardSide;
	teamB: MatchCardSide;
	// Optional call-to-action shown in the header in place of the status badge
	// (e.g. "Send inn →" / "Bekreft →" on action lists). Use the footer to spell
	// out the underlying status when this is set.
	cta?: MatchCardCta;
	footer?: React.ReactNode;
};

export function MatchCard({
	href,
	sport,
	round,
	status,
	submittedAt,
	teamA,
	teamB,
	cta,
	footer,
}: MatchCardProps) {
	const registered = formatRegistered(submittedAt ?? null);
	const decided = status === "confirmed";
	const hasScores = teamA.score != null || teamB.score != null;
	const defaultFooter =
		status === "pending"
			? `Avventer bekreftelse${registered ? ` · innsendt ${registered}` : ""}`
			: registered
				? `Registrert ${registered}`
				: null;
	const resolvedFooter = footer ?? defaultFooter;
	return (
		<Link
			href={href}
			className="card block overflow-hidden transition active:translate-y-px"
		>
			<div className="flex items-center justify-between gap-2 border-b-2 border-ink/10 bg-cream-50 px-3 py-2">
				<span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
					<span aria-hidden className="text-base leading-none">
						{sportEmoji(sport)}
					</span>
					<span>
						{sportLabel(sport)}
						{round ? ` · R${round}` : ""}
					</span>
				</span>
				{cta ? <CtaBadge cta={cta} /> : <StatusBadge status={status} />}
			</div>
			<div className="divide-y-2 divide-ink/10">
				<TeamRow side={teamA} decided={decided} hasScores={hasScores} />
				<TeamRow side={teamB} decided={decided} hasScores={hasScores} />
			</div>
			{resolvedFooter && (
				<div className="border-t-2 border-ink/10 bg-cream-50 px-3 py-1.5 text-[11px] font-medium text-ink/60">
					{resolvedFooter}
				</div>
			)}
		</Link>
	);
}

function CtaBadge({ cta }: { cta: MatchCardCta }) {
	const cls =
		cta.tone === "primary"
			? "bg-mustard text-ink border-ink"
			: "bg-cream-50 text-ink border-ink";
	return (
		<span
			className={`shrink-0 whitespace-nowrap rounded-full border-2 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${cls}`}
		>
			{cta.label}
		</span>
	);
}

function TeamRow({
	side,
	decided,
	hasScores,
}: {
	side: MatchCardSide;
	decided: boolean;
	hasScores: boolean;
}) {
	const winnerBg = decided && side.won ? "bg-mustard" : "";
	const loserMute = decided && side.lost ? "opacity-55" : "";
	const nameWeight = side.won ? "font-black" : "font-extrabold";
	return (
		<div
			className={`flex items-center justify-between gap-3 px-3 py-2.5 ${winnerBg} ${loserMute}`}
		>
			<div className="flex min-w-0 items-center gap-2">
				<Avatar
					src={side.avatarUrl ?? null}
					name={side.name}
					kind="team"
					size={32}
				/>
				{decided && side.won && (
					<span aria-hidden className="text-base leading-none">
						🏆
					</span>
				)}
				{side.isMine && (
					<span
						title="Mitt lag"
						className="inline-block h-2 w-2 shrink-0 rounded-full bg-teal"
					/>
				)}
				<span className={`truncate ${nameWeight}`}>{side.name}</span>
			</div>
			<span
				className={`shrink-0 tabular-nums leading-none ${
					hasScores ? "text-2xl font-black" : "text-lg font-bold text-ink/40"
				}`}
				style={{ fontFamily: "var(--font-display)" }}
			>
				{side.score ?? "–"}
			</span>
		</div>
	);
}

function StatusBadge({ status }: { status: SubmissionStatus | null }) {
	const cfg =
		status === "confirmed"
			? { label: "Bekreftet", cls: "bg-teal text-cream border-ink" }
			: status === "pending"
				? { label: "Avventer", cls: "bg-mustard text-ink border-ink" }
				: status === "disputed"
					? { label: "Bestridt", cls: "bg-terracotta text-cream border-ink" }
					: {
							label: "Planlagt",
							cls: "bg-cream-50 text-ink/60 border-ink/30",
						};
	return (
		<span
			className={`shrink-0 whitespace-nowrap rounded-full border-2 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${cfg.cls}`}
		>
			{cfg.label}
		</span>
	);
}

// Derive winner/loser flags for a head-to-head match (winner_team_id is set when confirmed).
export function matchSides({
	teamAId,
	teamAName,
	teamAAvatarUrl,
	teamBId,
	teamBName,
	teamBAvatarUrl,
	scoreA,
	scoreB,
	winnerTeamId,
	status,
	myTeamId,
}: {
	teamAId: string;
	teamAName: string;
	teamAAvatarUrl?: string | null;
	teamBId: string;
	teamBName: string;
	teamBAvatarUrl?: string | null;
	scoreA: number | null;
	scoreB: number | null;
	winnerTeamId: string | null;
	status: SubmissionStatus | null;
	myTeamId?: string | null;
}): { teamA: MatchCardSide; teamB: MatchCardSide } {
	const aWon = status === "confirmed" && winnerTeamId === teamAId;
	const bWon = status === "confirmed" && winnerTeamId === teamBId;
	return {
		teamA: {
			name: teamAName,
			avatarUrl: teamAAvatarUrl ?? null,
			score: scoreA,
			won: aWon,
			lost: bWon,
			isMine: myTeamId != null && teamAId === myTeamId,
		},
		teamB: {
			name: teamBName,
			avatarUrl: teamBAvatarUrl ?? null,
			score: scoreB,
			won: bWon,
			lost: aWon,
			isMine: myTeamId != null && teamBId === myTeamId,
		},
	};
}

// Derive winner/loser flags for a stroke-play flight (lower strokes wins).
export function flightSides({
	team1Id,
	team1Name,
	team1AvatarUrl,
	team2Id,
	team2Name,
	team2AvatarUrl,
	strokes1,
	strokes2,
	status,
	myTeamId,
}: {
	team1Id: string;
	team1Name: string;
	team1AvatarUrl?: string | null;
	team2Id: string;
	team2Name: string;
	team2AvatarUrl?: string | null;
	strokes1: number | null;
	strokes2: number | null;
	status: SubmissionStatus | null;
	myTeamId?: string | null;
}): { teamA: MatchCardSide; teamB: MatchCardSide } {
	const decided =
		status === "confirmed" && strokes1 != null && strokes2 != null;
	const oneWon = decided && (strokes1 as number) < (strokes2 as number);
	const twoWon = decided && (strokes2 as number) < (strokes1 as number);
	return {
		teamA: {
			name: team1Name,
			avatarUrl: team1AvatarUrl ?? null,
			score: strokes1,
			won: oneWon,
			lost: twoWon,
			isMine: myTeamId != null && team1Id === myTeamId,
		},
		teamB: {
			name: team2Name,
			avatarUrl: team2AvatarUrl ?? null,
			score: strokes2,
			won: twoWon,
			lost: oneWon,
			isMine: myTeamId != null && team2Id === myTeamId,
		},
	};
}
