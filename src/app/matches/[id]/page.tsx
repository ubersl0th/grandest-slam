import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { getSessionUser } from "@/lib/auth";
import { sportEmoji, sportLabel } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";
import { MatchPanel } from "./match-panel";

export const revalidate = 0;

export default async function MatchDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const user = await getSessionUser();
	if (!user) redirect(`/auth/sign-in?next=/matches/${id}`);

	const supabase = await createClient();

	const { data: match } = await supabase
		.from("matches")
		.select(
			"*, ta:team_a(id,name,avatar_url), tb:team_b(id,name,avatar_url), submitter:submitted_by(full_name)",
		)
		.eq("id", id)
		.maybeSingle();

	if (!match) notFound();

	const m = match as unknown as MatchRow;

	const myTeamId = user.team?.id ?? null;
	const onTeamA = myTeamId === m.team_a;
	const onTeamB = myTeamId === m.team_b;
	const isParticipant = onTeamA || onTeamB;
	const isAdmin =
		user.profile?.role === "admin" || user.profile?.role === "super_admin";

	return (
		<AppShell user={user} active="matches">
			<div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
				<Link
					href="/matches"
					className="text-sm font-bold opacity-70 hover:opacity-100"
				>
					← Alle kamper
				</Link>

				<div className="mt-4">
					<p className="tag">
						{sportEmoji(m.sport)} {sportLabel(m.sport)}
					</p>
					<h1
						className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-2xl sm:text-3xl md:text-4xl"
						style={{ fontFamily: "var(--font-display)" }}
					>
						<Link
							href={`/teams/${m.team_a}`}
							className="flex min-w-0 items-center gap-2 hover:underline"
						>
							<Avatar
								src={teamAvatar(m.ta)}
								name={teamName(m.ta)}
								kind="team"
								size={40}
							/>
							<span className="truncate">{teamName(m.ta)}</span>
						</Link>
						<span className="opacity-50">vs</span>
						<Link
							href={`/teams/${m.team_b}`}
							className="flex min-w-0 items-center gap-2 hover:underline"
						>
							<Avatar
								src={teamAvatar(m.tb)}
								name={teamName(m.tb)}
								kind="team"
								size={40}
							/>
							<span className="truncate">{teamName(m.tb)}</span>
						</Link>
					</h1>
				</div>

				<MatchPanel
					match={{
						id: m.id,
						sport: m.sport,
						team_a: m.team_a,
						team_b: m.team_b,
						score_a: m.score_a,
						score_b: m.score_b,
						winner_team_id: m.winner_team_id,
						status: m.status,
						submitted_by: m.submitted_by,
						submitter_name: m.submitter ? extractFullName(m.submitter) : null,
						team_a_name: teamName(m.ta),
						team_b_name: teamName(m.tb),
					}}
					viewer={{
						isParticipant,
						isAdmin,
						myTeamId,
						submittedByMyTeam:
							m.submitted_by_team !== null && m.submitted_by_team === myTeamId,
					}}
				/>
			</div>
		</AppShell>
	);
}

type TeamRel =
	| { id: string; name: string; avatar_url: string | null }
	| { id: string; name: string; avatar_url: string | null }[]
	| null;

type MatchRow = {
	id: string;
	sport: "padel" | "tennis";
	team_a: string;
	team_b: string;
	score_a: number | null;
	score_b: number | null;
	winner_team_id: string | null;
	status: "pending" | "confirmed" | "disputed" | null;
	submitted_by: string | null;
	submitted_by_team: string | null;
	ta: TeamRel;
	tb: TeamRel;
	submitter: { full_name: string } | { full_name: string }[] | null;
};

function teamName(rel: TeamRel) {
	if (!rel) return "?";
	return Array.isArray(rel) ? (rel[0]?.name ?? "?") : rel.name;
}
function teamAvatar(rel: TeamRel): string | null {
	if (!rel) return null;
	return Array.isArray(rel)
		? (rel[0]?.avatar_url ?? null)
		: (rel.avatar_url ?? null);
}
function extractFullName(
	rel: { full_name: string } | { full_name: string }[] | null,
) {
	if (!rel) return null;
	return Array.isArray(rel) ? (rel[0]?.full_name ?? null) : rel.full_name;
}
