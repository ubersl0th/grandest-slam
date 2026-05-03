import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Leaderboard } from "./leaderboard";

export const metadata = { title: "Resultatliste · The Grandest Slam" };
export const revalidate = 0;

export default async function LeaderboardPage() {
	const user = await getSessionUser();
	const supabase = await createClient();

	const { data: totals } = await supabase
		.from("team_totals")
		.select("*")
		.order("total_points", { ascending: false });

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
				<Leaderboard initial={totals ?? []} />
			</div>
		</AppShell>
	);
}
