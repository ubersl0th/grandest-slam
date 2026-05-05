import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type FlightRow, Leaderboard, type MatchRow } from "./leaderboard";

export const metadata = { title: "Resultatliste · The Grandest Slam" };
export const revalidate = 0;

export default async function LeaderboardPage() {
	const user = await getSessionUser();
	const supabase = await createClient();

	const [{ data: totals }, { data: flights }, { data: matches }] =
		await Promise.all([
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

	return (
		<AppShell user={user} active="leaderboard">
			<div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
				<h1
					className="text-4xl md:text-6xl"
					style={{ fontFamily: "var(--font-display)" }}
				>
					Resultatliste
				</h1>
				<p className="mt-2 text-[var(--color-ink)]/75">
					Oppdateres i det poengene er bekreftet.
				</p>
				<Leaderboard
					initial={totals ?? []}
					initialFlights={(flights ?? []) as FlightRow[]}
					initialMatches={(matches ?? []) as MatchRow[]}
				/>
			</div>
		</AppShell>
	);
}
