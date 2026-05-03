import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth";
import { SPORTS, sportEmoji, sportLabel } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mitt lag · The Grandest Slam" };
export const revalidate = 0;

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
						Du er logget inn, men er ikke tilknyttet et lag. Be en administrator
						om hjelp, eller meld deg på via påmeldingsskjemaet.
					</p>
					<Link href="/join" className="btn btn-primary mt-6">
						Meld på
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

				{/* Action: confirm pending */}
				<Section title="Venter på din bekreftelse">
					{[
						...((pendingMatches ?? []) as PendingMatch[])
							.filter((m) => needsOpponentConfirmation(m, team.id))
							.map((m) => ({ kind: "match" as const, m })),
						...((pendingFlights ?? []) as PendingFlight[])
							.filter((f) => needsOpponentConfirmationFlight(f, team.id))
							.map((f) => ({ kind: "flight" as const, f })),
					].length === 0 && <Empty>Du er à jour.</Empty>}
					{((pendingMatches ?? []) as PendingMatch[])
						.filter((m) => needsOpponentConfirmation(m, team.id))
						.map((m) => (
							<Link
								key={m.id}
								href={`/matches/${m.id}`}
								className="card flex items-center justify-between p-4 hover:translate-y-[-1px] transition-transform"
							>
								<div className="min-w-0">
									<p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]/60">
										{sportEmoji(m.sport)} {sportLabel(m.sport)}
									</p>
									<p className="mt-1 truncate font-extrabold">
										{extractName(m.ta)} {m.score_a}–{m.score_b}{" "}
										{extractName(m.tb)}
									</p>
									<p className="text-xs text-[var(--color-ink)]/60">
										Trykk for å bekrefte eller bestride
									</p>
								</div>
								<span className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-mustard)] px-3 py-1 text-xs font-black">
									Bekreft →
								</span>
							</Link>
						))}
					{((pendingFlights ?? []) as PendingFlight[])
						.filter((f) => needsOpponentConfirmationFlight(f, team.id))
						.map((f) => (
							<Link
								key={f.id}
								href={`/matches/flight/${f.id}`}
								className="card flex items-center justify-between p-4 hover:translate-y-[-1px] transition-transform"
							>
								<div className="min-w-0">
									<p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]/60">
										{sportEmoji(f.sport)} {sportLabel(f.sport)} · R
										{f.round_number}
									</p>
									<p className="mt-1 truncate font-extrabold">
										{extractName(f.t1)} {f.strokes_1}–{f.strokes_2}{" "}
										{extractName(f.t2)}
									</p>
									<p className="text-xs text-[var(--color-ink)]/60">
										Trykk for å bekrefte eller bestride
									</p>
								</div>
								<span className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-mustard)] px-3 py-1 text-xs font-black">
									Bekreft →
								</span>
							</Link>
						))}
				</Section>

				<Section title="Skal sendes inn">
					{(upcomingMatches ?? []).length === 0 &&
						(upcomingFlights ?? []).length === 0 && (
							<Empty>
								Ingenting planlagt enda — vent på at administratoren starter
								turneringen.
							</Empty>
						)}
					{((upcomingMatches ?? []) as PendingMatch[]).map((m) => (
						<Link
							key={m.id}
							href={`/matches/${m.id}`}
							className="card flex items-center justify-between p-4"
						>
							<div className="min-w-0">
								<p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]/60">
									{sportEmoji(m.sport)} {sportLabel(m.sport)}
								</p>
								<p className="mt-1 truncate font-extrabold">
									{extractName(m.ta)} <span className="opacity-50">vs</span>{" "}
									{extractName(m.tb)}
								</p>
							</div>
							<span className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-3 py-1 text-xs font-black">
								Send inn →
							</span>
						</Link>
					))}
					{((upcomingFlights ?? []) as PendingFlight[]).map((f) => (
						<Link
							key={f.id}
							href={`/matches/flight/${f.id}`}
							className="card flex items-center justify-between p-4"
						>
							<div className="min-w-0">
								<p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]/60">
									{sportEmoji(f.sport)} {sportLabel(f.sport)} · R
									{f.round_number}
								</p>
								<p className="mt-1 truncate font-extrabold">
									{extractName(f.t1)} <span className="opacity-50">vs</span>{" "}
									{extractName(f.t2)}
								</p>
							</div>
							<span className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-3 py-1 text-xs font-black">
								Send inn →
							</span>
						</Link>
					))}
				</Section>

				<Section title="Dine idretter">
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						{SPORTS.map((s) => (
							<Link
								key={s.key}
								href={`/leaderboard`}
								className="card flex flex-col items-center justify-center p-4 text-center"
							>
								<div className="text-3xl">{s.emoji}</div>
								<p className="mt-2 text-sm font-extrabold">{s.label}</p>
							</Link>
						))}
					</div>
				</Section>
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
			<div className="space-y-2">{children}</div>
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
