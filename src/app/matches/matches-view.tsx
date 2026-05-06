"use client";

import { useEffect, useState } from "react";
import { flightSides, MatchCard, matchSides } from "@/components/match-card";
import type { Sport, SubmissionStatus } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

type RawMatch = {
	id: string;
	sport: Sport;
	team_a: string;
	team_b: string;
	score_a: number | null;
	score_b: number | null;
	winner_team_id: string | null;
	status: SubmissionStatus | null;
	submitted_at: string | null;
	confirmed_at: string | null;
	created_at: string | null;
	ta: TeamRel;
	tb: TeamRel;
};
type RawFlight = {
	id: string;
	sport: Sport;
	round_number: number;
	team_1: string;
	team_2: string;
	strokes_1: number | null;
	strokes_2: number | null;
	status: SubmissionStatus | null;
	submitted_at: string | null;
	confirmed_at: string | null;
	created_at: string | null;
	t1: TeamRel;
	t2: TeamRel;
};

type TeamRel =
	| { name: string; avatar_url: string | null }
	| { name: string; avatar_url: string | null }[]
	| null;

const tabs: { key: "all" | "mine" | Sport; label: string }[] = [
	{ key: "all", label: "Alle" },
	{ key: "mine", label: "Mitt lag" },
	{ key: "padel", label: "Padel" },
	{ key: "tennis", label: "Tennis" },
	{ key: "disc_golf", label: "Frisbeegolf" },
	{ key: "golf", label: "Golf" },
];

function getName(rel: TeamRel) {
	if (!rel) return "?";
	return Array.isArray(rel) ? (rel[0]?.name ?? "?") : rel.name;
}
function getAvatar(rel: TeamRel): string | null {
	if (!rel) return null;
	return Array.isArray(rel)
		? (rel[0]?.avatar_url ?? null)
		: (rel.avatar_url ?? null);
}

export function MatchesView({
	initialMatches,
	initialFlights,
	myTeamId,
}: {
	initialMatches: unknown[];
	initialFlights: unknown[];
	myTeamId: string | null;
}) {
	const [matches, setMatches] = useState(initialMatches as RawMatch[]);
	const [flights, setFlights] = useState(initialFlights as RawFlight[]);
	const [tab, setTab] = useState<(typeof tabs)[number]["key"]>(
		myTeamId ? "mine" : "all",
	);

	useEffect(() => {
		const supabase = createClient();
		async function refresh() {
			const [m, f] = await Promise.all([
				supabase
					.from("matches")
					.select("*, ta:team_a(name, avatar_url), tb:team_b(name, avatar_url)")
					.order("created_at", { ascending: false }),
				supabase
					.from("flights")
					.select("*, t1:team_1(name, avatar_url), t2:team_2(name, avatar_url)")
					.order("round_number")
					.order("created_at", { ascending: false }),
			]);
			if (m.data) setMatches(m.data as RawMatch[]);
			if (f.data) setFlights(f.data as RawFlight[]);
		}
		const channel = supabase
			.channel("matches-page")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "matches" },
				refresh,
			)
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "flights" },
				refresh,
			)
			.subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, []);

	const filteredMatches = matches.filter((m) => {
		if (tab === "all") return true;
		if (tab === "mine")
			return myTeamId && (m.team_a === myTeamId || m.team_b === myTeamId);
		return m.sport === tab;
	});
	const filteredFlights = flights.filter((f) => {
		if (tab === "all") return true;
		if (tab === "mine")
			return myTeamId && (f.team_1 === myTeamId || f.team_2 === myTeamId);
		return f.sport === tab;
	});

	// Newest activity first: pick the most recent of confirmed_at, submitted_at, created_at.
	const lastActivity = (m: RawMatch | RawFlight) => {
		const t = (iso: string | null) =>
			iso ? new Date(iso).getTime() : Number.NEGATIVE_INFINITY;
		return Math.max(t(m.confirmed_at), t(m.submitted_at), t(m.created_at));
	};
	const compare = (a: RawMatch | RawFlight, b: RawMatch | RawFlight) =>
		lastActivity(b) - lastActivity(a);
	filteredMatches.sort(compare);
	filteredFlights.sort(compare);

	return (
		<div className="mt-6">
			<div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
				{tabs.map((t) => (
					<button
						type="button"
						key={t.key}
						onClick={() => setTab(t.key)}
						disabled={t.key === "mine" && !myTeamId}
						className={`shrink-0 rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold transition disabled:opacity-30 ${
							tab === t.key
								? "bg-ink text-cream"
								: "bg-cream-50 hover:bg-cream-200"
						}`}
					>
						{t.label}
					</button>
				))}
			</div>

			<ul className="mt-4 space-y-3">
				{filteredMatches.map((m) => {
					const sides = matchSides({
						teamAId: m.team_a,
						teamAName: getName(m.ta),
						teamAAvatarUrl: getAvatar(m.ta),
						teamBId: m.team_b,
						teamBName: getName(m.tb),
						teamBAvatarUrl: getAvatar(m.tb),
						scoreA: m.score_a,
						scoreB: m.score_b,
						winnerTeamId: m.winner_team_id,
						status: m.status,
						myTeamId,
					});
					return (
						<li key={m.id}>
							<MatchCard
								href={`/matches/${m.id}`}
								sport={m.sport}
								status={m.status}
								submittedAt={m.submitted_at}
								teamA={sides.teamA}
								teamB={sides.teamB}
							/>
						</li>
					);
				})}
				{filteredFlights.map((f) => {
					const sides = flightSides({
						team1Id: f.team_1,
						team1Name: getName(f.t1),
						team1AvatarUrl: getAvatar(f.t1),
						team2Id: f.team_2,
						team2Name: getName(f.t2),
						team2AvatarUrl: getAvatar(f.t2),
						strokes1: f.strokes_1,
						strokes2: f.strokes_2,
						status: f.status,
						myTeamId,
					});
					return (
						<li key={f.id}>
							<MatchCard
								href={`/matches/flight/${f.id}`}
								sport={f.sport}
								round={f.round_number}
								status={f.status}
								submittedAt={f.submitted_at}
								teamA={sides.teamA}
								teamB={sides.teamB}
							/>
						</li>
					);
				})}
				{filteredMatches.length === 0 && filteredFlights.length === 0 && (
					<li className="card p-6 text-center text-ink/60">
						Ingenting her enda.
					</li>
				)}
			</ul>
		</div>
	);
}
