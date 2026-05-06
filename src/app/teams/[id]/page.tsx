import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Avatar } from "@/components/avatar";
import { flightSides, MatchCard, matchSides } from "@/components/match-card";
import { TeamPointsBreakdown } from "@/components/team-points-breakdown";
import { getSessionUser } from "@/lib/auth";
import type { Profile } from "@/lib/database.types";
import { experienceLabel, SPORTS } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

export default async function TeamPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const user = await getSessionUser();
	const supabase = await createClient();

	const { data: team } = await supabase
		.from("teams")
		.select("*")
		.eq("id", id)
		.maybeSingle();

	if (!team) notFound();

	const { data: members } = await supabase
		.from("team_members")
		.select("profile_id, profiles(*)")
		.eq("team_id", id);

	type MemberRow = { profile_id: string; profiles: Profile | Profile[] | null };
	const memberProfile = (m: MemberRow): Profile | null =>
		Array.isArray(m.profiles) ? (m.profiles[0] ?? null) : m.profiles;
	const profileIds = ((members as unknown as MemberRow[]) ?? [])
		.map((m) => memberProfile(m)?.id)
		.filter((v): v is string => Boolean(v));

	const { data: experience } = await supabase
		.from("player_experience")
		.select("*")
		.in(
			"profile_id",
			profileIds.length ? profileIds : ["00000000-0000-0000-0000-000000000000"],
		);

	const { data: totals } = await supabase
		.from("team_totals")
		.select("*")
		.eq("team_id", id)
		.maybeSingle();

	// Recent matches & flights
	const { data: matches } = await supabase
		.from("matches")
		.select("*, ta:team_a(name, avatar_url), tb:team_b(name, avatar_url)")
		.or(`team_a.eq.${id},team_b.eq.${id}`)
		.order("created_at", { ascending: false })
		.limit(15);

	const { data: flights } = await supabase
		.from("flights")
		.select("*, t1:team_1(name, avatar_url), t2:team_2(name, avatar_url)")
		.or(`team_1.eq.${id},team_2.eq.${id}`)
		.order("created_at", { ascending: false })
		.limit(15);

	return (
		<AppShell user={user}>
			<div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
				<Link
					href="/leaderboard"
					className="text-sm font-bold opacity-70 hover:opacity-100"
				>
					← Tilbake til resultatlisten
				</Link>

				<div className="card mt-4 p-6 md:p-8">
					<div className="flex items-start justify-between gap-4">
						<div className="flex min-w-0 flex-1 items-start gap-4">
							<Avatar
								src={team.avatar_url}
								name={team.name}
								kind="team"
								size={72}
								className="hidden sm:inline-grid"
							/>
							<Avatar
								src={team.avatar_url}
								name={team.name}
								kind="team"
								size={56}
								className="inline-grid sm:hidden"
							/>
							<div className="min-w-0 flex-1">
								<h1
									className="text-3xl md:text-5xl"
									style={{ fontFamily: "var(--font-display)" }}
								>
									{team.name}
								</h1>
								{team.bio && (
									<p className="mt-3 text-[var(--color-ink)]/80">{team.bio}</p>
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

					<TeamPointsBreakdown totals={totals} className="mt-6" />
				</div>

				<h2
					className="mt-8 text-2xl"
					style={{ fontFamily: "var(--font-display)" }}
				>
					Spillere
				</h2>
				<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
					{((members as unknown as MemberRow[]) ?? []).map((m) => {
						const profile = memberProfile(m);
						if (!profile) return null;
						const exp = (experience ?? []).filter(
							(e) => e.profile_id === profile.id,
						);
						return (
							<div key={profile.id} className="card p-4">
								<div className="flex items-center gap-3">
									<Avatar
										src={profile.avatar_url}
										name={profile.full_name}
										kind="player"
										size={48}
									/>
									<p className="min-w-0 truncate text-lg font-extrabold">
										{profile.full_name}
									</p>
								</div>
								{profile.bio && (
									<p className="mt-2 text-sm text-[var(--color-ink)]/70">
										{profile.bio}
									</p>
								)}
								<ul className="mt-3 space-y-1 text-sm">
									{SPORTS.map((s) => {
										const e = exp.find((x) => x.sport === s.key);
										return (
											<li
												key={s.key}
												className="flex items-center justify-between"
											>
												<span>
													{s.emoji} {s.label}
												</span>
												<span className="font-bold">
													{experienceLabel(e?.level)}
												</span>
											</li>
										);
									})}
								</ul>
							</div>
						);
					})}
				</div>

				<h2
					className="mt-8 text-2xl"
					style={{ fontFamily: "var(--font-display)" }}
				>
					Siste resultater
				</h2>
				<div className="mt-3 space-y-3">
					{(matches ?? []).length === 0 && (flights ?? []).length === 0 && (
						<div className="card p-4 text-sm text-[var(--color-ink)]/60">
							Ingen resultater enda.
						</div>
					)}
					{(matches ?? []).map((m) => {
						const taRel = (
							m as unknown as {
								ta: { name: string; avatar_url: string | null } | null;
							}
						).ta;
						const tbRel = (
							m as unknown as {
								tb: { name: string; avatar_url: string | null } | null;
							}
						).tb;
						const sides = matchSides({
							teamAId: m.team_a,
							teamAName: taRel?.name ?? "?",
							teamAAvatarUrl: taRel?.avatar_url ?? null,
							teamBId: m.team_b,
							teamBName: tbRel?.name ?? "?",
							teamBAvatarUrl: tbRel?.avatar_url ?? null,
							scoreA: m.score_a,
							scoreB: m.score_b,
							winnerTeamId: m.winner_team_id,
							status: m.status,
							myTeamId: id,
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
					{(flights ?? []).map((f) => {
						const t1Rel = (
							f as unknown as {
								t1: { name: string; avatar_url: string | null } | null;
							}
						).t1;
						const t2Rel = (
							f as unknown as {
								t2: { name: string; avatar_url: string | null } | null;
							}
						).t2;
						const sides = flightSides({
							team1Id: f.team_1,
							team1Name: t1Rel?.name ?? "?",
							team1AvatarUrl: t1Rel?.avatar_url ?? null,
							team2Id: f.team_2,
							team2Name: t2Rel?.name ?? "?",
							team2AvatarUrl: t2Rel?.avatar_url ?? null,
							strokes1: f.strokes_1,
							strokes2: f.strokes_2,
							status: f.status,
							myTeamId: id,
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
				</div>
			</div>
		</AppShell>
	);
}
