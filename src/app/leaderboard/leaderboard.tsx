"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import type { Sport, TeamTotals } from "@/lib/database.types";
import { SPORTS, sportEmoji, sportLabel } from "@/lib/sports";
import { createClient } from "@/lib/supabase/client";

type Tab = "overall" | Sport;

export type FlightRow = {
	sport: Sport;
	round_number: number;
	team_1: string;
	team_2: string;
	strokes_1: number | null;
	strokes_2: number | null;
};

export type MatchRow = {
	sport: Sport;
	team_a: string;
	team_b: string;
	winner_team_id: string | null;
};

export function Leaderboard({
	initial,
	initialFlights,
	initialMatches,
}: {
	initial: TeamTotals[];
	initialFlights: FlightRow[];
	initialMatches: MatchRow[];
}) {
	const [rows, setRows] = useState<TeamTotals[]>(initial);
	const [flights, setFlights] = useState<FlightRow[]>(initialFlights);
	const [matches, setMatches] = useState<MatchRow[]>(initialMatches);
	const [tab, setTab] = useState<Tab>("overall");
	const [pulse, setPulse] = useState(false);

	useEffect(() => {
		const supabase = createClient();
		async function refresh() {
			const [
				{ data: totalsData },
				{ data: flightsData },
				{ data: matchesData },
			] = await Promise.all([
				supabase
					.from("team_totals")
					.select("*")
					.order("total_points", { ascending: false }),
				supabase
					.from("flights")
					.select("sport, round_number, team_1, team_2, strokes_1, strokes_2")
					.eq("status", "confirmed"),
				supabase
					.from("matches")
					.select("sport, team_a, team_b, winner_team_id")
					.eq("status", "confirmed"),
			]);
			if (totalsData) setRows(totalsData);
			if (flightsData) setFlights(flightsData as FlightRow[]);
			if (matchesData) setMatches(matchesData as MatchRow[]);
			if (totalsData || flightsData || matchesData) {
				setPulse(true);
				setTimeout(() => setPulse(false), 600);
			}
		}
		const channel = supabase
			.channel("leaderboard")
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
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "teams" },
				refresh,
			)
			.subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, []);

	// Map: sport → teamId → roundNumber → total strokes for that round
	const strokesByTeamRound = useMemo(() => {
		const map = new Map<Sport, Map<string, Map<number, number>>>();
		for (const f of flights) {
			if (f.sport !== "disc_golf" && f.sport !== "golf") continue;
			const sportMap =
				map.get(f.sport) ?? new Map<string, Map<number, number>>();
			const add = (teamId: string, strokes: number | null) => {
				if (strokes == null) return;
				const teamMap = sportMap.get(teamId) ?? new Map<number, number>();
				teamMap.set(
					f.round_number,
					(teamMap.get(f.round_number) ?? 0) + strokes,
				);
				sportMap.set(teamId, teamMap);
			};
			add(f.team_1, f.strokes_1);
			add(f.team_2, f.strokes_2);
			map.set(f.sport, sportMap);
		}
		return map;
	}, [flights]);

	function roundsForTeam(sport: Sport, teamId: string): [number, number][] {
		const teamMap = strokesByTeamRound.get(sport)?.get(teamId);
		if (!teamMap) return [];
		return [...teamMap.entries()].sort(([a], [b]) => a - b);
	}

	// Map: sport → teamId → { wins, losses }
	const recordByTeam = useMemo(() => {
		const map = new Map<Sport, Map<string, { wins: number; losses: number }>>();
		for (const m of matches) {
			if (m.sport !== "padel" && m.sport !== "tennis") continue;
			const sportMap =
				map.get(m.sport) ?? new Map<string, { wins: number; losses: number }>();
			const bump = (teamId: string, field: "wins" | "losses") => {
				const rec = sportMap.get(teamId) ?? { wins: 0, losses: 0 };
				rec[field] += 1;
				sportMap.set(teamId, rec);
			};
			if (m.winner_team_id === m.team_a) {
				bump(m.team_a, "wins");
				bump(m.team_b, "losses");
			} else if (m.winner_team_id === m.team_b) {
				bump(m.team_b, "wins");
				bump(m.team_a, "losses");
			}
			map.set(m.sport, sportMap);
		}
		return map;
	}, [matches]);

	function recordForTeam(
		sport: Sport,
		teamId: string,
	): { wins: number; losses: number } {
		return recordByTeam.get(sport)?.get(teamId) ?? { wins: 0, losses: 0 };
	}

	const sorted = useMemo(() => {
		const key: keyof TeamTotals =
			tab === "overall"
				? "total_points"
				: tab === "padel"
					? "padel_points"
					: tab === "tennis"
						? "tennis_points"
						: tab === "disc_golf"
							? "disc_golf_points"
							: "golf_points";
		return [...rows].sort((a, b) => (b[key] as number) - (a[key] as number));
	}, [rows, tab]);

	const tabs: { key: Tab; label: string; emoji?: string }[] = [
		{ key: "overall", label: "Totalt", emoji: "🏆" },
		...SPORTS.map((s) => ({
			key: s.key as Tab,
			label: s.label,
			emoji: s.emoji,
		})),
	];

	return (
		<div className="mt-6">
			<div className="flex flex-wrap gap-2 overflow-x-auto pb-2 -mx-1 px-1">
				{tabs.map((t) => (
					<button
						type="button"
						key={t.key}
						onClick={() => setTab(t.key)}
						className={`rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold transition shrink-0 ${
							tab === t.key
								? "bg-ink text-cream"
								: "bg-cream-50 hover:bg-cream-200"
						}`}
					>
						<span className="mr-1.5" aria-hidden>
							{t.emoji}
						</span>
						{t.label}
					</button>
				))}
			</div>

			<div
				className={`mt-4 transition-shadow ${pulse ? "ring-4 ring-mustard rounded-2xl" : ""}`}
			>
				<ol className="space-y-2">
					{sorted.map((row, i) => {
						const points =
							tab === "overall"
								? row.total_points
								: tab === "padel"
									? row.padel_points
									: tab === "tennis"
										? row.tennis_points
										: tab === "disc_golf"
											? row.disc_golf_points
											: row.golf_points;
						return (
							<li key={row.team_id}>
								<Link
									href={`/teams/${row.team_id}`}
									className="card flex items-center gap-3 p-3 md:p-4 hover:-translate-y-px transition-transform"
								>
									<Rank pos={i + 1} />
									<Avatar
										src={row.team_avatar_url}
										name={row.team_name}
										kind="team"
										size={40}
									/>
									<div className="flex-1 min-w-0">
										<p className="truncate font-extrabold">{row.team_name}</p>
										{tab === "overall" && (
											<p className="text-xs text-ink/60">
												Padel {row.padel_points} · Tennis {row.tennis_points} ·
												Frisbee {row.disc_golf_points} · Golf {row.golf_points}
											</p>
										)}
										{(tab === "padel" || tab === "tennis") && (
											<p className="text-xs text-ink/60">
												{(() => {
													const { wins, losses } = recordForTeam(
														tab,
														row.team_id,
													);
													if (wins === 0 && losses === 0)
														return `${sportEmoji(tab)} ${sportLabel(tab)} · ingen kamper enda`;
													return `${wins} seier${wins === 1 ? "" : "e"} · ${losses} tap`;
												})()}
											</p>
										)}
										{(tab === "disc_golf" || tab === "golf") && (
											<p className="text-xs text-ink/60">
												{(() => {
													const rounds = roundsForTeam(tab, row.team_id);
													if (rounds.length === 0)
														return `${sportEmoji(tab)} ${sportLabel(tab)} · ingen runder enda`;
													return rounds
														.map(([r, s]) => `R${r}: ${s} slag`)
														.join(" · ");
												})()}
											</p>
										)}
									</div>
									<div
										className="grid h-12 min-w-12 place-items-center rounded-xl border-2 border-ink bg-mustard px-3 text-xl font-black"
										style={{ fontFamily: "var(--font-display)" }}
									>
										{points}
									</div>
								</Link>
							</li>
						);
					})}
					{sorted.length === 0 && (
						<li className="card p-8 text-center text-ink/60">
							Ingen lag enda.
						</li>
					)}
				</ol>
			</div>
		</div>
	);
}

function Rank({ pos }: { pos: number }) {
	const styles =
		pos === 1
			? "bg-mustard"
			: pos === 2
				? "bg-cream-200"
				: pos === 3
					? "bg-terracotta text-cream"
					: "bg-cream-50";
	return (
		<div
			className={`grid h-10 w-10 place-items-center rounded-full border-2 border-ink text-base font-black ${styles}`}
			style={{ fontFamily: "var(--font-display)" }}
		>
			{pos}
		</div>
	);
}
