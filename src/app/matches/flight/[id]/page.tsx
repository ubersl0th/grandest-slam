import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { getSessionUser } from "@/lib/auth";
import { sportEmoji, sportLabel } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";
import { FlightPanel } from "./flight-panel";

export const revalidate = 0;

export default async function FlightDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const user = await getSessionUser();
	if (!user) redirect(`/auth/sign-in?next=/matches/flight/${id}`);

	const supabase = await createClient();

	const { data: flight } = await supabase
		.from("flights")
		.select(
			"*, t1:team_1(id,name,avatar_url), t2:team_2(id,name,avatar_url), submitter:submitted_by(full_name)",
		)
		.eq("id", id)
		.maybeSingle();

	if (!flight) notFound();
	const f = flight as unknown as FlightRow;

	const myTeamId = user.team?.id ?? null;
	const isParticipant = myTeamId === f.team_1 || myTeamId === f.team_2;
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
						{sportEmoji(f.sport)} {sportLabel(f.sport)} · Runde {f.round_number}
					</p>
					<h1
						className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-2xl sm:text-3xl md:text-4xl"
						style={{ fontFamily: "var(--font-display)" }}
					>
						<Link
							href={`/teams/${f.team_1}`}
							className="flex min-w-0 items-center gap-2 hover:underline"
						>
							<Avatar
								src={teamAvatar(f.t1)}
								name={teamName(f.t1)}
								kind="team"
								size={40}
							/>
							<span className="truncate">{teamName(f.t1)}</span>
						</Link>
						<span className="opacity-50">vs</span>
						<Link
							href={`/teams/${f.team_2}`}
							className="flex min-w-0 items-center gap-2 hover:underline"
						>
							<Avatar
								src={teamAvatar(f.t2)}
								name={teamName(f.t2)}
								kind="team"
								size={40}
							/>
							<span className="truncate">{teamName(f.t2)}</span>
						</Link>
					</h1>
					<p className="mt-2 text-sm text-[var(--color-ink)]/65">
						Beste ball / beste disk — én slagscore per lag.
					</p>
				</div>

				<FlightPanel
					flight={{
						id: f.id,
						sport: f.sport,
						round_number: f.round_number,
						team_1: f.team_1,
						team_2: f.team_2,
						strokes_1: f.strokes_1,
						strokes_2: f.strokes_2,
						status: f.status,
						submitted_by: f.submitted_by,
						submitter_name: extractFullName(f.submitter),
						team_1_name: teamName(f.t1),
						team_2_name: teamName(f.t2),
					}}
					viewer={{
						isParticipant,
						isAdmin,
						myTeamId,
						submittedByMyTeam:
							f.submitted_by_team !== null && f.submitted_by_team === myTeamId,
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

type FlightRow = {
	id: string;
	sport: "disc_golf" | "golf";
	round_number: number;
	team_1: string;
	team_2: string;
	strokes_1: number | null;
	strokes_2: number | null;
	status: "pending" | "confirmed" | "disputed" | null;
	submitted_by: string | null;
	submitted_by_team: string | null;
	t1: TeamRel;
	t2: TeamRel;
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
