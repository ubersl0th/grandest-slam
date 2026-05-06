import Link from "next/link";
import { redirect } from "next/navigation";
import { TeamNameControls } from "@/app/teams/[id]/team-name-controls";
import { AppShell } from "@/components/app-shell";
import { flightSides, MatchCard, matchSides } from "@/components/match-card";
import { TeamPointsBreakdown } from "@/components/team-points-breakdown";
import { getSessionUser } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mitt lag · The Grandest Slam" };
export const revalidate = 0;

function ordinal(n: number): string {
	return `${n}.`;
}

export default async function DashboardPage() {
	const user = await getSessionUser();
	if (!user) redirect("/auth/sign-in?next=/dashboard");

	const supabase = await createClient();

	const team = user.team;
	if (!team) {
		return (
			<AppShell user={user} active="dashboard">
				<div className="mx-auto max-w-2xl px-5 py-10">
					<h1
						className="text-3xl"
						style={{ fontFamily: "var(--font-display)" }}
					>
						Ingen lag enda
					</h1>
					<p className="mt-2 text-[var(--color-ink)]/75">
						Du er logget inn, men er ikke tilknyttet et lag. Fyll ut profilen
						din med ferdighetsnivåer — så plukker en administrator deg ut når
						lagene settes sammen.
					</p>
					<Link href="/profile" className="btn btn-primary mt-6">
						Til profilen min
					</Link>
				</div>
			</AppShell>
		);
	}

	// Pending matches (where this team is participating).
	const { data: pendingMatches } = await supabase
		.from("matches")
		.select("*, ta:team_a(name), tb:team_b(name)")
		.eq("status", "pending")
		.or(`team_a.eq.${team.id},team_b.eq.${team.id}`);

	const { data: pendingFlights } = await supabase
		.from("flights")
		.select("*, t1:team_1(name), t2:team_2(name)")
		.eq("status", "pending")
		.or(`team_1.eq.${team.id},team_2.eq.${team.id}`);

	// Upcoming (no submission yet)
	const { data: upcomingMatches } = await supabase
		.from("matches")
		.select("*, ta:team_a(name), tb:team_b(name)")
		.is("status", null)
		.or(`team_a.eq.${team.id},team_b.eq.${team.id}`)
		.limit(20);

	const { data: upcomingFlights } = await supabase
		.from("flights")
		.select("*, t1:team_1(name), t2:team_2(name)")
		.is("status", null)
		.or(`team_1.eq.${team.id},team_2.eq.${team.id}`)
		.order("round_number")
		.limit(20);

	const { data: allTotals } = await supabase
		.from("team_totals")
		.select("*")
		.order("total_points", { ascending: false });

	const totals = (allTotals ?? []).find((t) => t.team_id === team.id) ?? null;
	const totalTeams = (allTotals ?? []).length;
	const rank =
		totalTeams > 0
			? (allTotals ?? []).findIndex((t) => t.team_id === team.id) + 1
			: 0;

	const { data: recentMatches } = await supabase
		.from("matches")
		.select("*, ta:team_a(name), tb:team_b(name)")
		.eq("status", "confirmed")
		.or(`team_a.eq.${team.id},team_b.eq.${team.id}`)
		.order("submitted_at", { ascending: false, nullsFirst: false })
		.limit(8);

	const { data: recentFlights } = await supabase
		.from("flights")
		.select("*, t1:team_1(name), t2:team_2(name)")
		.eq("status", "confirmed")
		.or(`team_1.eq.${team.id},team_2.eq.${team.id}`)
		.order("submitted_at", { ascending: false, nullsFirst: false })
		.limit(8);

	const { data: members } = await supabase
		.from("team_members")
		.select("profile_id, profiles(*)")
		.eq("team_id", team.id);

	type MemberRow = { profile_id: string; profiles: Profile | Profile[] | null };
	const memberProfile = (m: MemberRow): Profile | null =>
		Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles;
	const memberProfiles = ((members as unknown as MemberRow[]) ?? [])
		.map(memberProfile)
		.filter((p): p is Profile => Boolean(p));
	const teammate = memberProfiles.find((p) => p.id !== user.id) ?? null;
	const requester =
		memberProfiles.find((p) => p.id === team.pending_name_requested_by) ?? null;

	return (
		<AppShell user={user} active="dashboard">
			<div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
				<p className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]/60">
					Velkommen
				</p>
				<h1
					className="mt-1 text-3xl md:text-5xl"
					style={{ fontFamily: "var(--font-display)" }}
				>
					{user.profile?.full_name?.split(" ")[0] ?? "Spiller"}
				</h1>
				<p className="mt-2 text-[var(--color-ink)]/75">
					Lag:{" "}
					<Link href={`/teams/${team.id}`} className="font-bold underline">
						{team.name}
					</Link>
				</p>

				<Link
					href="/leaderboard"
					className="card mt-6 block p-5 md:p-6 hover:-translate-y-px transition-transform"
				>
					<div className="flex items-start justify-between gap-4">
						<div className="min-w-0">
							<p className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]/60">
								Plassering
							</p>
							<div
								className="mt-1 text-3xl md:text-4xl"
								style={{ fontFamily: "var(--font-display)" }}
							>
								{rank > 0 ? (
									<>
										<div>{ordinal(rank)} plass</div>
										<div className="text-2xl text-[var(--color-ink)]/55 md:text-3xl">
											av {totalTeams}
										</div>
									</>
								) : (
									"Ingen plassering enda"
								)}
							</div>
						</div>
						<div
							className="grid h-16 min-w-16 place-items-center rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-mustard)] px-3 text-2xl font-black"
							style={{ fontFamily: "var(--font-display)" }}
						>
							{totals?.total_points ?? 0}
						</div>
					</div>
					<TeamPointsBreakdown totals={totals} className="mt-4" />
				</Link>

				{/* Action: confirm pending */}
				<Section title="Venter på din bekreftelse">
					{(() => {
						const confirmMatches = (
							(pendingMatches ?? []) as PendingMatch[]
						).filter((m) => needsOpponentConfirmation(m, team.id));
						const confirmFlights = (
							(pendingFlights ?? []) as PendingFlight[]
						).filter((f) => needsOpponentConfirmationFlight(f, team.id));
						if (confirmMatches.length === 0 && confirmFlights.length === 0) {
							return <Empty>Du er à jour.</Empty>;
						}
						return (
							<>
								{confirmMatches.map((m) => {
									const sides = matchSides({
										teamAId: m.team_a,
										teamAName: extractName(m.ta),
										teamBId: m.team_b,
										teamBName: extractName(m.tb),
										scoreA: m.score_a,
										scoreB: m.score_b,
										winnerTeamId: null,
										status: m.status,
										myTeamId: team.id,
									});
									return (
										<MatchCard
											key={m.id}
											href={`/matches/${m.id}`}
											sport={m.sport}
											status={m.status}
											teamA={sides.teamA}
											teamB={sides.teamB}
											cta={{ label: "Bekreft →", tone: "primary" }}
											footer="Trykk for å bekrefte eller bestride"
										/>
									);
								})}
								{confirmFlights.map((f) => {
									const sides = flightSides({
										team1Id: f.team_1,
										team1Name: extractName(f.t1),
										team2Id: f.team_2,
										team2Name: extractName(f.t2),
										strokes1: f.strokes_1,
										strokes2: f.strokes_2,
										status: f.status,
										myTeamId: team.id,
									});
									return (
										<MatchCard
											key={f.id}
											href={`/matches/flight/${f.id}`}
											sport={f.sport}
											round={f.round_number}
											status={f.status}
											teamA={sides.teamA}
											teamB={sides.teamB}
											cta={{ label: "Bekreft →", tone: "primary" }}
											footer="Trykk for å bekrefte eller bestride"
										/>
									);
								})}
							</>
						);
					})()}
				</Section>

				<Section title="Skal sendes inn">
					{(upcomingMatches ?? []).length === 0 &&
						(upcomingFlights ?? []).length === 0 && (
							<Empty>
								Ingenting planlagt enda — vent på at administratoren starter
								turneringen.
							</Empty>
						)}
					{((upcomingMatches ?? []) as PendingMatch[]).map((m) => {
						const sides = matchSides({
							teamAId: m.team_a,
							teamAName: extractName(m.ta),
							teamBId: m.team_b,
							teamBName: extractName(m.tb),
							scoreA: null,
							scoreB: null,
							winnerTeamId: null,
							status: null,
							myTeamId: team.id,
						});
						return (
							<MatchCard
								key={m.id}
								href={`/matches/${m.id}`}
								sport={m.sport}
								status={null}
								teamA={sides.teamA}
								teamB={sides.teamB}
								cta={{ label: "Send inn →" }}
							/>
						);
					})}
					{((upcomingFlights ?? []) as PendingFlight[]).map((f) => {
						const sides = flightSides({
							team1Id: f.team_1,
							team1Name: extractName(f.t1),
							team2Id: f.team_2,
							team2Name: extractName(f.t2),
							strokes1: null,
							strokes2: null,
							status: null,
							myTeamId: team.id,
						});
						return (
							<MatchCard
								key={f.id}
								href={`/matches/flight/${f.id}`}
								sport={f.sport}
								round={f.round_number}
								status={null}
								teamA={sides.teamA}
								teamB={sides.teamB}
								cta={{ label: "Send inn →" }}
							/>
						);
					})}
				</Section>

				<Section title="Siste resultater">
					{((recentMatches ?? []) as RecentMatch[]).length === 0 &&
						((recentFlights ?? []) as RecentFlight[]).length === 0 && (
							<Empty>Ingen bekreftede resultater enda.</Empty>
						)}
					{((recentMatches ?? []) as RecentMatch[]).map((m) => {
						const sides = matchSides({
							teamAId: m.team_a,
							teamAName: extractName(m.ta),
							teamBId: m.team_b,
							teamBName: extractName(m.tb),
							scoreA: m.score_a,
							scoreB: m.score_b,
							winnerTeamId: m.winner_team_id,
							status: m.status,
							myTeamId: team.id,
						});
						return (
							<MatchCard
								key={m.id}
								href={`/matches/${m.id}`}
								sport={m.sport}
								status={m.status}
								submittedAt={m.submitted_at}
								teamA={sides.teamA}
								teamB={sides.teamB}
							/>
						);
					})}
					{((recentFlights ?? []) as RecentFlight[]).map((f) => {
						const sides = flightSides({
							team1Id: f.team_1,
							team1Name: extractName(f.t1),
							team2Id: f.team_2,
							team2Name: extractName(f.t2),
							strokes1: f.strokes_1,
							strokes2: f.strokes_2,
							status: f.status,
							myTeamId: team.id,
						});
						return (
							<MatchCard
								key={f.id}
								href={`/matches/flight/${f.id}`}
								sport={f.sport}
								round={f.round_number}
								status={f.status}
								submittedAt={f.submitted_at}
								teamA={sides.teamA}
								teamB={sides.teamB}
							/>
						);
					})}
				</Section>

				<TeamNameControls
					team={team}
					currentUserId={user.id}
					teammate={teammate}
					requester={requester}
				/>
			</div>
		</AppShell>
	);
}

type PendingMatch = {
	id: string;
	sport: "padel" | "tennis";
	team_a: string;
	team_b: string;
	score_a: number | null;
	score_b: number | null;
	status: "pending" | "confirmed" | "disputed" | null;
	submitted_by: string | null;
	submitted_by_team: string | null;
	ta: { name: string } | { name: string }[] | null;
	tb: { name: string } | { name: string }[] | null;
};
type PendingFlight = {
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
	t1: { name: string } | { name: string }[] | null;
	t2: { name: string } | { name: string }[] | null;
};
type RecentMatch = PendingMatch & {
	winner_team_id: string | null;
	submitted_at: string | null;
};
type RecentFlight = PendingFlight & {
	submitted_at: string | null;
};

function extractName(
	rel: { name: string } | { name: string }[] | null,
): string {
	if (!rel) return "?";
	if (Array.isArray(rel)) return rel[0]?.name ?? "?";
	return rel.name;
}

// Pending result needs MY team to confirm only when the OPPOSING team submitted.
function needsOpponentConfirmation(m: PendingMatch, myTeamId: string) {
	return Boolean(
		m.submitted_by_team &&
			m.submitted_by_team !== myTeamId &&
			(m.team_a === myTeamId || m.team_b === myTeamId),
	);
}
function needsOpponentConfirmationFlight(f: PendingFlight, myTeamId: string) {
	return Boolean(
		f.submitted_by_team &&
			f.submitted_by_team !== myTeamId &&
			(f.team_1 === myTeamId || f.team_2 === myTeamId),
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mt-8">
			<h2
				className="mb-3 text-xl"
				style={{ fontFamily: "var(--font-display)" }}
			>
				{title}
			</h2>
			<div className="space-y-3">{children}</div>
		</section>
	);
}

function Empty({ children }: { children: React.ReactNode }) {
	return (
		<div className="card p-4 text-sm text-[var(--color-ink)]/60">
			{children}
		</div>
	);
}
