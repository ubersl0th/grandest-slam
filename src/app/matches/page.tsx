import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MatchesView } from "./matches-view";

export const metadata = { title: "Kamper · The Grandest Slam" };
export const revalidate = 0;

export default async function MatchesPage() {
	const user = await getSessionUser();
	if (!user) redirect("/auth/sign-in?next=/matches");

	const supabase = await createClient();

	const [{ data: matches }, { data: flights }] = await Promise.all([
		supabase
			.from("matches")
			.select("*, ta:team_a(name), tb:team_b(name)")
			.order("created_at", { ascending: false }),
		supabase
			.from("flights")
			.select("*, t1:team_1(name), t2:team_2(name)")
			.order("round_number", { ascending: true })
			.order("created_at", { ascending: false }),
	]);

	return (
		<AppShell user={user} active="matches">
			<div className="mx-auto max-w-3xl px-4 py-6 md:py-10">
				<h1
					className="text-3xl md:text-5xl"
					style={{ fontFamily: "var(--font-display)" }}
				>
					Kamper
				</h1>
				<p className="mt-2 text-[var(--color-ink)]/75">
					Send inn et resultat. Trykk på en rad for å bekrefte eller bestride.
				</p>
				<MatchesView
					initialMatches={matches ?? []}
					initialFlights={flights ?? []}
					myTeamId={user.team?.id ?? null}
				/>
			</div>
		</AppShell>
	);
}
