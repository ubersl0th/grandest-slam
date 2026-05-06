"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";
import { flightSides, MatchCard, matchSides } from "@/components/match-card";
import type {
	ActivityLog,
	ExperienceLevel,
	PlayerExperience,
	PlayerSubmission,
	Profile,
	Sport,
	SubmissionStatus,
	Team,
	TeamMember,
	TeamSubmission,
	Tournament,
	UserRole,
} from "@/lib/database.types";
import { EXPERIENCE_WEIGHTS, experienceLabel, SPORTS } from "@/lib/sports";
import { createClient } from "@/lib/supabase/client";
import {
	type BalancePlayer,
	type BalanceResult,
	generateBalancedTeams,
} from "@/lib/team-balancer";
import { ActivityLogPanel } from "./activity-log-panel";

type Section =
	| "overview"
	| "submissions"
	| "teams"
	| "schedule"
	| "results"
	| "activity"
	| "players"
	| "admins";

type Props = {
	isSuperAdmin: boolean;
	tournament: Tournament | null;
	teams: Team[];
	profiles: Profile[];
	teamMembers: TeamMember[];
	experience: PlayerExperience[];
	matches: unknown[];
	flights: unknown[];
	submissions: PlayerSubmission[];
	teamSubmissions: TeamSubmission[];
	activity: ActivityLog[];
};

export function AdminConsole(props: Props) {
	const [section, setSection] = useState<Section>("overview");
	const router = useRouter();
	const supabase = createClient();
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
		null,
	);

	async function action(
		fn: () => PromiseLike<{ error: { message: string } | null }>,
		ok: string,
	) {
		setBusy(true);
		setMsg(null);
		const { error } = await fn();
		setBusy(false);
		if (error) setMsg({ kind: "err", text: error.message });
		else {
			setMsg({ kind: "ok", text: ok });
			router.refresh();
		}
	}

	const pendingCount =
		props.submissions.filter((s) => s.status === "pending").length +
		props.teamSubmissions.filter((s) => s.status === "pending").length;
	const tabs: { key: Section; label: string; badge?: number }[] = [
		{ key: "overview", label: "Oversikt" },
		{
			key: "submissions",
			label: "Påmeldinger",
			badge: pendingCount || undefined,
		},
		{ key: "teams", label: "Lag" },
		{ key: "players", label: "Spillere" },
		{ key: "schedule", label: "Oppsett" },
		{ key: "results", label: "Resultater" },
		{ key: "activity", label: "Aktivitetslogg" },
		...(props.isSuperAdmin
			? [{ key: "admins" as const, label: "Administratorer" }]
			: []),
	];

	return (
		<div className="mt-6">
			<div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
				{tabs.map((t) => (
					<button
						type="button"
						key={t.key}
						onClick={() => setSection(t.key)}
						className={`shrink-0 rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold transition ${
							section === t.key
								? "bg-ink text-cream"
								: "bg-cream-50 hover:bg-cream-200"
						}`}
					>
						{t.label}
						{t.badge ? (
							<span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1.5 text-[11px] font-black text-cream">
								{t.badge}
							</span>
						) : null}
					</button>
				))}
			</div>

			{msg && (
				<div
					className={`card mt-4 p-3 text-sm font-bold ${
						msg.kind === "ok"
							? "border-teal bg-teal/10 text-teal-dark"
							: "border-terracotta bg-terracotta/10 text-terracotta-dark"
					}`}
				>
					{msg.text}
				</div>
			)}

			{section === "overview" && (
				<Overview
					tournament={props.tournament}
					teamCount={props.teams.length}
					matches={props.matches}
					flights={props.flights}
					busy={busy}
					onStart={() =>
						action(
							() => supabase.rpc("start_tournament"),
							"Turneringen er startet.",
						)
					}
					onEnd={() =>
						action(
							() => supabase.rpc("end_tournament"),
							"Turneringen er avsluttet.",
						)
					}
					onGenerateRoundRobin={() =>
						action(
							() => supabase.rpc("generate_round_robin"),
							"Serieoppsett generert for Padel og Tennis.",
						)
					}
				/>
			)}

			{section === "submissions" && (
				<SubmissionsPanel
					submissions={props.submissions}
					teamSubmissions={props.teamSubmissions}
					busy={busy}
					setBusy={setBusy}
					setMsg={setMsg}
					router={router}
				/>
			)}

			{section === "teams" && (
				<TeamsPanel
					teams={props.teams}
					profiles={props.profiles}
					teamMembers={props.teamMembers}
					experience={props.experience}
					busy={busy}
					action={action}
					supabase={supabase}
				/>
			)}

			{section === "schedule" && (
				<SchedulePanel
					teams={props.teams}
					flights={props.flights}
					busy={busy}
					action={action}
					supabase={supabase}
				/>
			)}

			{section === "results" && (
				<ResultsPanel matches={props.matches} flights={props.flights} />
			)}

			{section === "activity" && (
				<ActivityLogPanel
					initial={props.activity}
					teams={props.teams}
					profiles={props.profiles}
				/>
			)}

			{section === "players" && (
				<PlayersPanel
					profiles={props.profiles}
					teamMembers={props.teamMembers}
					teams={props.teams}
					busy={busy}
					action={action}
					supabase={supabase}
				/>
			)}

			{section === "admins" && props.isSuperAdmin && (
				<AdminsPanel
					profiles={props.profiles}
					busy={busy}
					action={action}
					supabase={supabase}
				/>
			)}
		</div>
	);
}

type ActionFn = (
	fn: () => PromiseLike<{ error: { message: string } | null }>,
	ok: string,
) => Promise<void>;
type SupabaseLike = ReturnType<typeof createClient>;

function Overview({
	tournament,
	teamCount,
	matches,
	flights,
	busy,
	onStart,
	onEnd,
	onGenerateRoundRobin,
}: {
	tournament: Tournament | null;
	teamCount: number;
	matches: unknown[];
	flights: unknown[];
	busy: boolean;
	onStart: () => void;
	onEnd: () => void;
	onGenerateRoundRobin: () => void;
}) {
	const status = tournament?.status ?? "not_started";
	const matchStats = useMatchStats(matches);
	const flightStats = useFlightStats(flights);

	return (
		<div className="mt-4 space-y-4">
			<div className="card p-5">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="min-w-0">
						<p className="text-xs font-bold uppercase tracking-widest text-ink/60">
							Status
						</p>
						<p
							className="mt-1 text-3xl"
							style={{ fontFamily: "var(--font-display)" }}
						>
							{labelFor(status)}
						</p>
						<p className="mt-1 text-sm text-ink/70">
							{teamCount} {teamCount === 1 ? "lag" : "lag"} påmeldt
						</p>
					</div>
					<div className="flex flex-col gap-2 sm:items-end">
						{status !== "active" && (
							<button
								type="button"
								onClick={onStart}
								disabled={busy || teamCount < 2}
								className="btn btn-primary w-full disabled:opacity-50 sm:w-auto"
							>
								Start turnering
							</button>
						)}
						{status === "active" && (
							<button
								type="button"
								onClick={onEnd}
								disabled={busy}
								className="btn btn-secondary w-full disabled:opacity-50 sm:w-auto"
							>
								Avslutt turnering
							</button>
						)}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<Stat label="Lag" value={teamCount} />
				<Stat label="Kamper" value={matchStats.total} />
				<Stat
					label="Avventer"
					value={matchStats.pending + flightStats.pending}
				/>
				<Stat
					label="Bekreftet"
					value={matchStats.confirmed + flightStats.confirmed}
				/>
			</div>

			<div className="card p-5">
				<h3 className="text-lg font-extrabold">Oppsetthandlinger</h3>
				<p className="mt-1 text-sm text-ink/70">
					Generer Padel- og Tennis-serieoppsettet når lagene er på plass. Legg
					til runder for Frisbeegolf og Golf i Oppsett-fanen.
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={onGenerateRoundRobin}
						disabled={busy || teamCount < 2}
						className="btn btn-secondary w-full disabled:opacity-50 sm:w-auto"
					>
						Generer serieoppsett (Padel og Tennis)
					</button>
				</div>
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: number | string }) {
	return (
		<div className="card p-4 text-center">
			<p className="text-xs font-bold uppercase tracking-widest text-ink/60">
				{label}
			</p>
			<p
				className="mt-1 text-3xl"
				style={{ fontFamily: "var(--font-display)" }}
			>
				{value}
			</p>
		</div>
	);
}

function labelFor(s: string) {
	const map: Record<string, string> = {
		not_started: "Ikke startet",
		active: "Aktiv",
		ended: "Avsluttet",
	};
	return (
		map[s] ??
		s
			.split("_")
			.map((w) => w[0].toUpperCase() + w.slice(1))
			.join(" ")
	);
}

function useMatchStats(matches: unknown[]) {
	return useMemo(() => {
		const arr = matches as { status: string | null }[];
		return {
			total: arr.length,
			pending: arr.filter((m) => m.status === "pending").length,
			confirmed: arr.filter((m) => m.status === "confirmed").length,
			disputed: arr.filter((m) => m.status === "disputed").length,
		};
	}, [matches]);
}
function useFlightStats(flights: unknown[]) {
	return useMemo(() => {
		const arr = flights as { status: string | null }[];
		return {
			total: arr.length,
			pending: arr.filter((m) => m.status === "pending").length,
			confirmed: arr.filter((m) => m.status === "confirmed").length,
			disputed: arr.filter((m) => m.status === "disputed").length,
		};
	}, [flights]);
}

function TeamsPanel({
	teams,
	profiles,
	teamMembers,
	experience,
	busy,
	action,
	supabase,
}: {
	teams: Team[];
	profiles: Profile[];
	teamMembers: TeamMember[];
	experience: PlayerExperience[];
	busy: boolean;
	action: ActionFn;
	supabase: SupabaseLike;
}) {
	const router = useRouter();
	const [preview, setPreview] = useState<BalanceResult | null>(null);
	const [generating, setGenerating] = useState(false);
	const [applyError, setApplyError] = useState<string | null>(null);

	const profilesById = useMemo(() => {
		const m = new Map<string, Profile>();
		for (const p of profiles) m.set(p.id, p);
		return m;
	}, [profiles]);

	const experienceByProfile = useMemo(() => {
		const m = new Map<string, Record<Sport, ExperienceLevel>>();
		for (const e of experience) {
			const cur = m.get(e.profile_id) ?? ({} as Record<Sport, ExperienceLevel>);
			cur[e.sport] = e.level;
			m.set(e.profile_id, cur);
		}
		return m;
	}, [experience]);

	const rosters = useMemo(() => {
		const m = new Map<string, Profile[]>();
		for (const t of teams) m.set(t.id, []);
		for (const tm of teamMembers) {
			const p = profilesById.get(tm.profile_id);
			const arr = m.get(tm.team_id);
			if (p && arr) arr.push(p);
		}
		return m;
	}, [teams, teamMembers, profilesById]);

	const assignedProfileIds = useMemo(
		() => new Set(teamMembers.map((tm) => tm.profile_id)),
		[teamMembers],
	);

	const unassigned = useMemo(() => {
		return profiles.filter(
			(p) =>
				!assignedProfileIds.has(p.id) &&
				hasFullExperience(experienceByProfile.get(p.id)),
		);
	}, [profiles, assignedProfileIds, experienceByProfile]);

	function generatePreview() {
		setApplyError(null);
		if (unassigned.length < 2) return;
		setGenerating(true);
		setTimeout(() => {
			const input: BalancePlayer[] = unassigned.map((p) => {
				const experience = experienceByProfile.get(p.id);
				if (!experience) throw "missing experience";
				return {
					id: p.id,
					experience: experience,
				};
			});
			const result = generateBalancedTeams(input);
			setPreview(result);
			setGenerating(false);
		}, 0);
	}

	async function applyPreview() {
		if (!preview) return;
		setApplyError(null);
		const existingNames = new Set(teams.map((t) => t.name.toLowerCase()));
		let counter = teams.length + 1;
		for (const pair of preview.pairs) {
			let name = "";
			while (true) {
				const candidate = `Lag ${counter++}`;
				if (!existingNames.has(candidate.toLowerCase())) {
					name = candidate;
					existingNames.add(candidate.toLowerCase());
					break;
				}
			}
			const { data: team, error: teamErr } = await supabase
				.from("teams")
				.insert({ name })
				.select()
				.single();
			if (teamErr || !team) {
				setApplyError(teamErr?.message ?? "Kunne ikke opprette laget.");
				router.refresh();
				return;
			}
			const teamRow = team as Team;
			const { error: memberErr } = await supabase.from("team_members").insert([
				{ team_id: teamRow.id, profile_id: pair[0].id },
				{ team_id: teamRow.id, profile_id: pair[1].id },
			]);
			if (memberErr) {
				setApplyError(memberErr.message);
				router.refresh();
				return;
			}
		}
		setPreview(null);
		router.refresh();
	}

	async function createEmptyTeam() {
		const existingNames = new Set(teams.map((t) => t.name.toLowerCase()));
		let counter = teams.length + 1;
		let name = "";
		while (true) {
			const candidate = `Team ${counter++}`;
			if (!existingNames.has(candidate.toLowerCase())) {
				name = candidate;
				break;
			}
		}
		await action(
			async () => supabase.from("teams").insert({ name }),
			`Opprettet ${name}.`,
		);
	}

	return (
		<div className="mt-4 space-y-4">
			<div className="card p-4 sm:p-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h3 className="text-lg font-extrabold">Spillerliste</h3>
						<p className="mt-1 text-sm text-ink/70">
							{unassigned.length} uten lag · {teams.length}{" "}
							{teams.length === 1 ? "lag" : "lag"}
						</p>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
						<button
							type="button"
							onClick={generatePreview}
							disabled={busy || generating || unassigned.length < 2}
							className="btn btn-primary w-full disabled:opacity-50 sm:w-auto"
						>
							{generating ? "Regner ut…" : "Generer lag automatisk"}
						</button>
						<button
							type="button"
							onClick={createEmptyTeam}
							disabled={busy}
							className="btn btn-secondary w-full disabled:opacity-50 sm:w-auto"
						>
							Legg til tomt lag
						</button>
					</div>
				</div>

				{unassigned.length > 0 && (
					<div className="mt-4">
						<p className="text-xs font-bold uppercase tracking-widest text-ink/60">
							Spillere uten lag
						</p>
						<div className="mt-2 flex flex-wrap gap-2">
							{unassigned.map((p) => (
								<UnassignedChip
									key={p.id}
									profile={p}
									experience={experienceByProfile.get(p.id)}
									teams={teams}
									rosters={rosters}
									busy={busy}
									onAssign={(teamId) =>
										action(
											async () =>
												supabase
													.from("team_members")
													.insert({ team_id: teamId, profile_id: p.id }),
											`La til ${p.full_name} på laget.`,
										)
									}
								/>
							))}
						</div>
					</div>
				)}
			</div>

			{applyError && (
				<div className="card border-terracotta bg-terracotta/10 p-3 text-sm font-bold text-terracotta-dark">
					{applyError}
				</div>
			)}

			{preview && (
				<PreviewPanel
					preview={preview}
					experienceByProfile={experienceByProfile}
					profilesById={profilesById}
					busy={busy}
					onApply={applyPreview}
					onRegenerate={generatePreview}
					onCancel={() => setPreview(null)}
				/>
			)}

			<div className="space-y-2">
				{teams.length === 0 && (
					<div className="card p-6 text-center text-ink/60">
						Ingen lag enda.
					</div>
				)}
				{teams.map((t) => (
					<TeamCard
						key={t.id}
						team={t}
						members={rosters.get(t.id) ?? []}
						unassigned={unassigned}
						busy={busy}
						onDelete={() =>
							action(async () => {
								if (!window.confirm(`Slette laget «${t.name}»?`))
									return { error: null };
								return supabase.from("teams").delete().eq("id", t.id);
							}, `Slettet ${t.name}.`)
						}
						onRename={(name) =>
							action(
								async () =>
									supabase.from("teams").update({ name }).eq("id", t.id),
								`Navnet ble endret.`,
							)
						}
						onAddMember={(profileId) =>
							action(
								async () =>
									supabase
										.from("team_members")
										.insert({ team_id: t.id, profile_id: profileId }),
								"Lagt til på laget.",
							)
						}
						onRemoveMember={(profileId) =>
							action(
								async () =>
									supabase
										.from("team_members")
										.delete()
										.eq("team_id", t.id)
										.eq("profile_id", profileId),
								"Fjernet fra laget.",
							)
						}
					/>
				))}
			</div>
		</div>
	);
}

function hasFullExperience(
	exp: Record<Sport, ExperienceLevel> | undefined,
): exp is Record<Sport, ExperienceLevel> {
	if (!exp) return false;
	return SPORTS.every((s) => Boolean(exp[s.key]));
}

function UnassignedChip({
	profile,
	experience,
	teams,
	rosters,
	busy,
	onAssign,
}: {
	profile: Profile;
	experience: Record<Sport, ExperienceLevel> | undefined;
	teams: Team[];
	rosters: Map<string, Profile[]>;
	busy: boolean;
	onAssign: (teamId: string) => void;
}) {
	const eligibleTeams = teams.filter(
		(t) => (rosters.get(t.id)?.length ?? 0) < 2,
	);
	const total = experience
		? SPORTS.reduce(
				(acc, s) => acc + (EXPERIENCE_WEIGHTS[experience[s.key]] ?? 0),
				0,
			)
		: 0;
	return (
		<div className="flex min-w-[180px] items-start gap-2 rounded-xl border-2 border-ink bg-cream-50 p-2">
			<Avatar
				src={profile.avatar_url}
				name={profile.full_name}
				kind="player"
				size={32}
			/>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-extrabold">
					{profile.nickname || profile.full_name}
				</p>
				<p className="text-[10px] uppercase tracking-wider text-ink/60">
					nivå {total}
				</p>
				{eligibleTeams.length > 0 && (
					<select
						disabled={busy}
						defaultValue=""
						onChange={(e) => {
							if (e.target.value) onAssign(e.target.value);
						}}
						className="mt-1 w-full rounded-full border-2 border-ink bg-cream px-2 py-1 text-[11px] font-bold"
					>
						<option value="">Legg til på lag…</option>
						{eligibleTeams.map((t) => (
							<option key={t.id} value={t.id}>
								{t.name}
							</option>
						))}
					</select>
				)}
			</div>
		</div>
	);
}

function PreviewPanel({
	preview,
	experienceByProfile,
	profilesById,
	busy,
	onApply,
	onRegenerate,
	onCancel,
}: {
	preview: BalanceResult;
	experienceByProfile: Map<string, Record<Sport, ExperienceLevel>>;
	profilesById: Map<string, Profile>;
	busy: boolean;
	onApply: () => void;
	onRegenerate: () => void;
	onCancel: () => void;
}) {
	return (
		<div className="card border-teal bg-teal/5 p-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="text-lg font-extrabold">Foreslåtte parringer</h3>
					<p className="mt-1 text-sm text-ink/70">
						Spredning i parnivå per idrett (lavere = mer balansert):
					</p>
					<ul className="mt-1 flex flex-wrap gap-2 text-xs">
						{SPORTS.map((s) => (
							<li
								key={s.key}
								className="rounded-full border-2 border-ink bg-cream-50 px-2 py-0.5"
							>
								{s.emoji} {s.label}: {preview.perSportSpread[s.key].min}–
								{preview.perSportSpread[s.key].max}
							</li>
						))}
					</ul>
				</div>
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={onApply}
						disabled={busy}
						className="btn btn-primary disabled:opacity-50"
					>
						Bruk parringene
					</button>
					<button
						type="button"
						onClick={onRegenerate}
						disabled={busy}
						className="btn btn-secondary disabled:opacity-50"
					>
						Nytt forsøk
					</button>
					<button
						type="button"
						onClick={onCancel}
						disabled={busy}
						className="rounded-full border-2 border-ink bg-cream-50 px-4 py-2 text-sm font-bold disabled:opacity-50"
					>
						Avbryt
					</button>
				</div>
			</div>
			<div className="mt-4 space-y-2">
				{preview.pairs.map((pair, idx) => {
					const a = profilesById.get(pair[0].id);
					const b = profilesById.get(pair[1].id);
					const expA = experienceByProfile.get(pair[0].id);
					const expB = experienceByProfile.get(pair[1].id);
					return (
						<div
							key={pair[0].id + pair[1].id}
							className="rounded-xl border-2 border-ink bg-cream-50 p-3"
						>
							<p className="text-xs font-bold uppercase tracking-wider text-ink/60">
								Lag {idx + 1}
							</p>
							<div className="mt-1 flex flex-wrap items-center gap-2">
								<span className="inline-flex min-w-0 items-center gap-2 text-base font-extrabold">
									<Avatar
										src={a?.avatar_url}
										name={a?.full_name}
										kind="player"
										size={28}
									/>
									<span className="truncate">
										{a?.nickname || a?.full_name}
									</span>
								</span>
								<span aria-hidden className="opacity-50">
									+
								</span>
								<span className="inline-flex min-w-0 items-center gap-2 text-base font-extrabold">
									<Avatar
										src={b?.avatar_url}
										name={b?.full_name}
										kind="player"
										size={28}
									/>
									<span className="truncate">
										{b?.nickname || b?.full_name}
									</span>
								</span>
							</div>
							<ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink/70">
								{SPORTS.map((s) => (
									<li key={s.key}>
										{s.emoji}{" "}
										{EXPERIENCE_WEIGHTS[expA?.[s.key] ?? "beginner"] +
											EXPERIENCE_WEIGHTS[expB?.[s.key] ?? "beginner"]}
									</li>
								))}
							</ul>
						</div>
					);
				})}
				{preview.unassigned &&
					(() => {
						const u = profilesById.get(preview.unassigned.id);
						return (
							<div className="rounded-xl border-2 border-dashed border-ink bg-cream-50 p-3">
								<p className="text-xs font-bold uppercase tracking-wider text-ink/60">
									Uten lag (oddetall spillere)
								</p>
								<div className="mt-1 inline-flex items-center gap-2">
									<Avatar
										src={u?.avatar_url}
										name={u?.full_name}
										kind="player"
										size={28}
									/>
									<span className="font-extrabold">
										{u?.nickname || u?.full_name}
									</span>
								</div>
							</div>
						);
					})()}
			</div>
		</div>
	);
}

function TeamCard({
	team,
	members,
	unassigned,
	busy,
	onDelete,
	onRename,
	onAddMember,
	onRemoveMember,
}: {
	team: Team;
	members: Profile[];
	unassigned: Profile[];
	busy: boolean;
	onDelete: () => void;
	onRename: (name: string) => void;
	onAddMember: (profileId: string) => void;
	onRemoveMember: (profileId: string) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(team.name);
	const canAdd = members.length < 2 && unassigned.length > 0;

	return (
		<div className="card p-3 sm:p-4">
			<div className="flex items-start gap-3">
				<Avatar src={team.avatar_url} name={team.name} kind="team" size={44} />
				<div className="min-w-0 flex-1">
					{editing ? (
						<input
							className="input !py-1.5 !text-base"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onBlur={() => {
								if (name !== team.name && name.trim().length >= 2)
									onRename(name.trim());
								setEditing(false);
							}}
						/>
					) : (
						<Link
							href={`/teams/${team.id}`}
							className="block truncate text-base font-extrabold hover:underline"
						>
							{team.name}
						</Link>
					)}
					{team.bio && (
						<p className="mt-0.5 line-clamp-2 text-xs text-ink/60">
							{team.bio}
						</p>
					)}
				</div>
			</div>

			<div className="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => setEditing((e) => !e)}
					className="rounded-full border-2 border-ink bg-cream-50 px-3 py-1 text-xs font-bold"
				>
					{editing ? "Avbryt" : "Endre navn"}
				</button>
				<button
					type="button"
					onClick={onDelete}
					disabled={busy}
					className="rounded-full border-2 border-ink bg-terracotta px-3 py-1 text-xs font-bold text-cream disabled:opacity-50"
				>
					Slett laget
				</button>
			</div>

			<div className="mt-3 space-y-2">
				{members.length === 0 && (
					<p className="text-xs italic text-ink/60">Ingen medlemmer.</p>
				)}
				{members.map((m) => (
					<div
						key={m.id}
						className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink bg-cream-50 px-2.5 py-2"
					>
						<div className="flex min-w-0 flex-1 items-center gap-2.5">
							<Avatar
								src={m.avatar_url}
								name={m.full_name}
								kind="player"
								size={32}
							/>
							<div className="min-w-0">
								<p className="truncate text-sm font-bold">
									{m.nickname || m.full_name}
								</p>
								<p className="truncate text-[10px] text-ink/60">{m.email}</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => onRemoveMember(m.id)}
							disabled={busy}
							className="shrink-0 rounded-full border-2 border-ink bg-cream px-2.5 py-1 text-[11px] font-bold disabled:opacity-50"
						>
							Fjern
						</button>
					</div>
				))}
				{canAdd && (
					<select
						disabled={busy}
						defaultValue=""
						onChange={(e) => {
							if (e.target.value) onAddMember(e.target.value);
						}}
						className="input !py-2 !text-sm"
					>
						<option value="">+ Legg til spiller…</option>
						{unassigned.map((p) => (
							<option key={p.id} value={p.id}>
								{p.nickname || p.full_name} ({p.email})
							</option>
						))}
					</select>
				)}
			</div>
		</div>
	);
}

function SchedulePanel({
	teams,
	flights,
	busy,
	action,
	supabase,
}: {
	teams: Team[];
	flights: unknown[];
	busy: boolean;
	action: ActionFn;
	supabase: SupabaseLike;
}) {
	const [sport, setSport] = useState<Sport>("disc_golf");
	const [round, setRound] = useState(1);
	const [t1, setT1] = useState<string>("");
	const [t2, setT2] = useState<string>("");

	return (
		<div className="mt-4 space-y-5">
			<div className="card p-5">
				<h3 className="text-lg font-extrabold">Legg til runde</h3>
				<p className="mt-1 text-sm text-ink/70">
					Frisbeegolf- og Golf-runder parer to lag. Spillerne spiller sammen i
					best ball; én slagscore per lag.
				</p>
				<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
					<label className="block">
						<span className="label">Idrett</span>
						<select
							className="input"
							value={sport}
							onChange={(e) => setSport(e.target.value as Sport)}
						>
							<option value="disc_golf">Frisbeegolf</option>
							<option value="golf">Golf</option>
						</select>
					</label>
					<label className="block">
						<span className="label">Runde</span>
						<select
							className="input"
							value={round}
							onChange={(e) => setRound(Number(e.target.value))}
						>
							<option value={1}>Runde 1</option>
							<option value={2}>Runde 2</option>
						</select>
					</label>
					<label className="block">
						<span className="label">Lag 1</span>
						<select
							className="input"
							value={t1}
							onChange={(e) => setT1(e.target.value)}
						>
							<option value="">— velg —</option>
							{teams.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
					</label>
					<label className="block">
						<span className="label">Lag 2</span>
						<select
							className="input"
							value={t2}
							onChange={(e) => setT2(e.target.value)}
						>
							<option value="">— velg —</option>
							{teams.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
					</label>
				</div>
				<button
					type="button"
					disabled={busy || !t1 || !t2 || t1 === t2}
					onClick={() =>
						action(
							() =>
								supabase.from("flights").insert({
									sport,
									round_number: round,
									team_1: t1,
									team_2: t2,
								}),
							"Runde lagt til.",
						)
					}
					className="btn btn-primary mt-4 w-full disabled:opacity-50 sm:w-auto"
				>
					Legg til runde
				</button>
			</div>

			<div>
				<h3 className="mb-3 text-lg font-extrabold">Eksisterende runder</h3>
				<div className="space-y-2">
					{flights.length === 0 && (
						<div className="card p-4 text-center text-sm text-ink/60">
							Ingen runder enda.
						</div>
					)}
					{(flights as FlightWithTeams[]).map((f) => (
						<FlightRow
							key={f.id}
							flight={f}
							busy={busy}
							onDelete={() =>
								action(async () => {
									if (!window.confirm("Slette denne runden?"))
										return { error: null };
									return supabase.from("flights").delete().eq("id", f.id);
								}, "Runde slettet.")
							}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

type FlightWithTeams = {
	id: string;
	sport: Sport;
	round_number: number;
	team_1: string;
	team_2: string;
	strokes_1: number | null;
	strokes_2: number | null;
	status: SubmissionStatus | null;
	submitted_at: string | null;
	t1: TeamRel;
	t2: TeamRel;
};

function FlightRow({
	flight,
	busy,
	onDelete,
}: {
	flight: FlightWithTeams;
	busy: boolean;
	onDelete: () => void;
}) {
	const sides = flightSides({
		team1Id: flight.team_1,
		team1Name: relName(flight.t1),
		team1AvatarUrl: relAvatar(flight.t1),
		team2Id: flight.team_2,
		team2Name: relName(flight.t2),
		team2AvatarUrl: relAvatar(flight.t2),
		strokes1: flight.strokes_1,
		strokes2: flight.strokes_2,
		status: flight.status,
	});
	return (
		<div className="space-y-2">
			<MatchCard
				href={`/matches/flight/${flight.id}`}
				sport={flight.sport}
				round={flight.round_number}
				status={flight.status}
				submittedAt={flight.submitted_at}
				teamA={sides.teamA}
				teamB={sides.teamB}
			/>
			<div className="flex justify-end">
				<button
					type="button"
					onClick={onDelete}
					disabled={busy}
					className="rounded-full border-2 border-ink bg-terracotta px-3 py-1 text-xs font-bold text-cream disabled:opacity-50"
				>
					Slett runde
				</button>
			</div>
		</div>
	);
}

function ResultsPanel({
	matches,
	flights,
}: {
	matches: unknown[];
	flights: unknown[];
}) {
	const [filter, setFilter] = useState<
		"all" | "pending" | "confirmed" | "disputed"
	>("all");
	const allMatches = matches as MatchWithTeams[];
	const allFlights = flights as FlightWithTeams[];

	const visibleMatches = allMatches.filter((m) =>
		filter === "all" ? true : m.status === filter,
	);
	const visibleFlights = allFlights.filter((f) =>
		filter === "all" ? true : f.status === filter,
	);

	const tabs: { key: typeof filter; label: string; count: number }[] = [
		{
			key: "all",
			label: "Alle",
			count: allMatches.length + allFlights.length,
		},
		{
			key: "pending",
			label: "Avventer",
			count:
				allMatches.filter((m) => m.status === "pending").length +
				allFlights.filter((f) => f.status === "pending").length,
		},
		{
			key: "confirmed",
			label: "Bekreftet",
			count:
				allMatches.filter((m) => m.status === "confirmed").length +
				allFlights.filter((f) => f.status === "confirmed").length,
		},
		{
			key: "disputed",
			label: "Bestridt",
			count:
				allMatches.filter((m) => m.status === "disputed").length +
				allFlights.filter((f) => f.status === "disputed").length,
		},
	];

	return (
		<div className="mt-4 space-y-3">
			<div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
				{tabs.map((t) => (
					<button
						type="button"
						key={t.key}
						onClick={() => setFilter(t.key)}
						className={`shrink-0 rounded-full border-2 border-ink px-3 py-1 text-xs font-bold transition ${
							filter === t.key ? "bg-ink text-cream" : "bg-cream-50"
						}`}
					>
						{t.label}
						{t.count > 0 && (
							<span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cream/40 px-1.5 text-[10px] font-black">
								{t.count}
							</span>
						)}
					</button>
				))}
			</div>

			{visibleMatches.length === 0 && visibleFlights.length === 0 && (
				<div className="card p-6 text-center text-ink/60">
					Ingenting å vise her.
				</div>
			)}

			<div className="space-y-3">
				{visibleMatches.map((m) => {
					const sides = matchSides({
						teamAId: m.team_a,
						teamAName: relName(m.ta),
						teamAAvatarUrl: relAvatar(m.ta),
						teamBId: m.team_b,
						teamBName: relName(m.tb),
						teamBAvatarUrl: relAvatar(m.tb),
						scoreA: m.score_a,
						scoreB: m.score_b,
						winnerTeamId: m.winner_team_id,
						status: m.status,
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
				{visibleFlights.map((f) => {
					const sides = flightSides({
						team1Id: f.team_1,
						team1Name: relName(f.t1),
						team1AvatarUrl: relAvatar(f.t1),
						team2Id: f.team_2,
						team2Name: relName(f.t2),
						team2AvatarUrl: relAvatar(f.t2),
						strokes1: f.strokes_1,
						strokes2: f.strokes_2,
						status: f.status,
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
	);
}

type TeamRel =
	| { name: string; avatar_url: string | null }
	| { name: string; avatar_url: string | null }[]
	| null;

function relName(rel: TeamRel): string {
	if (!rel) return "?";
	return Array.isArray(rel) ? (rel[0]?.name ?? "?") : rel.name;
}
function relAvatar(rel: TeamRel): string | null {
	if (!rel) return null;
	return Array.isArray(rel)
		? (rel[0]?.avatar_url ?? null)
		: (rel.avatar_url ?? null);
}

type MatchWithTeams = {
	id: string;
	sport: Sport;
	team_a: string;
	team_b: string;
	score_a: number | null;
	score_b: number | null;
	winner_team_id: string | null;
	status: SubmissionStatus | null;
	submitted_at: string | null;
	ta: TeamRel;
	tb: TeamRel;
};

function PlayersPanel({
	profiles,
	teamMembers,
	teams,
	busy,
	action,
	supabase,
}: {
	profiles: Profile[];
	teamMembers: TeamMember[];
	teams: Team[];
	busy: boolean;
	action: ActionFn;
	supabase: SupabaseLike;
}) {
	const [filter, setFilter] = useState("");
	const teamById = useMemo(() => {
		const m = new Map<string, Team>();
		for (const t of teams) m.set(t.id, t);
		return m;
	}, [teams]);
	const teamForProfile = useMemo(() => {
		const m = new Map<string, Team>();
		for (const tm of teamMembers) {
			const t = teamById.get(tm.team_id);
			if (t) m.set(tm.profile_id, t);
		}
		return m;
	}, [teamMembers, teamById]);

	const filtered = useMemo(() => {
		const q = filter.trim().toLowerCase();
		if (!q) return profiles;
		return profiles.filter((p) =>
			[p.full_name, p.nickname ?? "", p.email]
				.join(" ")
				.toLowerCase()
				.includes(q),
		);
	}, [profiles, filter]);

	return (
		<div className="mt-4 space-y-3">
			<div className="card p-4">
				<label className="block">
					<span className="label">Søk</span>
					<input
						className="input"
						placeholder="Navn, kallenavn eller e-post"
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
					/>
				</label>
				<p className="mt-2 text-xs text-ink/60">
					{filtered.length} av {profiles.length} brukere
				</p>
			</div>

			<div className="space-y-2">
				{filtered.map((p) => (
					<PlayerRow
						key={p.id}
						profile={p}
						team={teamForProfile.get(p.id) ?? null}
						busy={busy}
						onSaveNickname={(nickname) =>
							action(async () => {
								const { error } = await supabase.rpc(
									"admin_update_player_nickname",
									{ p_profile_id: p.id, p_nickname: nickname },
								);
								return { error };
							}, "Kallenavnet er oppdatert.")
						}
					/>
				))}
				{filtered.length === 0 && (
					<div className="card p-6 text-center text-ink/60">Ingen treff.</div>
				)}
			</div>
		</div>
	);
}

function PlayerRow({
	profile,
	team,
	busy,
	onSaveNickname,
}: {
	profile: Profile;
	team: Team | null;
	busy: boolean;
	onSaveNickname: (nickname: string) => Promise<void> | void;
}) {
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(profile.nickname ?? "");

	function commit() {
		const next = value.trim();
		const cur = profile.nickname ?? "";
		if (next !== cur) onSaveNickname(next);
		setEditing(false);
	}

	return (
		<div className="card flex flex-wrap items-center gap-3 p-3">
			<div className="flex min-w-0 flex-1 items-center gap-3">
				<Avatar
					src={profile.avatar_url}
					name={profile.full_name}
					kind="player"
					size={40}
				/>
				<div className="min-w-0 flex-1">
					<p className="truncate font-extrabold">{profile.full_name}</p>
					<p className="truncate text-xs text-ink/60">{profile.email}</p>
					{team && (
						<p className="mt-0.5 inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-ink/70">
							<span>Lag:</span>
							<Avatar
								src={team.avatar_url}
								name={team.name}
								kind="team"
								size={16}
							/>
							<span className="truncate">{team.name}</span>
						</p>
					)}
				</div>
			</div>
			<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
				{editing ? (
					<>
						<input
							// biome-ignore lint/a11y/noAutofocus: focus the input after entering edit mode
							autoFocus
							className="input !py-1 !text-sm"
							maxLength={40}
							placeholder="Kallenavn"
							value={value}
							onChange={(e) => setValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") commit();
								if (e.key === "Escape") {
									setValue(profile.nickname ?? "");
									setEditing(false);
								}
							}}
						/>
						<button
							type="button"
							onClick={commit}
							disabled={busy}
							className="rounded-full border-2 border-ink bg-mustard px-3 py-1 text-xs font-bold disabled:opacity-50"
						>
							Lagre
						</button>
						<button
							type="button"
							onClick={() => {
								setValue(profile.nickname ?? "");
								setEditing(false);
							}}
							className="rounded-full border-2 border-ink bg-cream-50 px-3 py-1 text-xs font-bold"
						>
							Avbryt
						</button>
					</>
				) : (
					<>
						<span className="rounded-full border-2 border-ink bg-cream-50 px-3 py-1 text-xs font-bold">
							{profile.nickname ? `«${profile.nickname}»` : "Uten kallenavn"}
						</span>
						<button
							type="button"
							onClick={() => setEditing(true)}
							disabled={busy}
							className="rounded-full border-2 border-ink bg-cream px-3 py-1 text-xs font-bold disabled:opacity-50"
						>
							Endre kallenavn
						</button>
					</>
				)}
			</div>
		</div>
	);
}

function AdminsPanel({
	profiles,
	busy,
	action,
	supabase,
}: {
	profiles: Profile[];
	busy: boolean;
	action: ActionFn;
	supabase: SupabaseLike;
}) {
	return (
		<div className="mt-4 space-y-2">
			<p className="text-sm text-ink/70">
				Gi spillere administratorrolle slik at de kan administrere lag og løse
				tvister. Superadministrator kan ikke endres fra grensesnittet.
			</p>
			{profiles.map((p) => (
				<div key={p.id} className="card flex flex-wrap items-center gap-3 p-3">
					<div className="flex min-w-0 flex-1 items-center gap-3">
						<Avatar
							src={p.avatar_url}
							name={p.full_name}
							kind="player"
							size={36}
						/>
						<div className="min-w-0 flex-1">
							<p className="truncate font-extrabold">{p.full_name}</p>
							<p className="truncate text-xs text-ink/60">{p.email}</p>
						</div>
					</div>
					<div className="flex w-full items-center justify-end gap-2 sm:w-auto">
						<RoleBadge role={p.role} />
						{p.role !== "super_admin" && (
							<select
								disabled={busy}
								value={p.role}
								onChange={(e) =>
									action(async () => {
										const { error } = await supabase.rpc("set_user_role", {
											p_profile_id: p.id,
											p_role: e.target.value as UserRole,
										});
										return { error };
									}, `${p.full_name} er oppdatert.`)
								}
								className="rounded-full border-2 border-ink bg-cream-50 px-2 py-1 text-xs font-bold"
							>
								<option value="player">Spiller</option>
								<option value="admin">Admin</option>
							</select>
						)}
					</div>
				</div>
			))}
		</div>
	);
}

function SubmissionsPanel({
	submissions,
	teamSubmissions,
	busy,
	setBusy,
	setMsg,
	router,
}: {
	submissions: PlayerSubmission[];
	teamSubmissions: TeamSubmission[];
	busy: boolean;
	setBusy: (b: boolean) => void;
	setMsg: (m: { kind: "ok" | "err"; text: string } | null) => void;
	router: ReturnType<typeof useRouter>;
}) {
	const [filter, setFilter] = useState<"pending" | "all">("pending");
	type Entry =
		| {
				kind: "solo";
				created_at: string;
				status: PlayerSubmission["status"];
				sub: PlayerSubmission;
		  }
		| {
				kind: "team";
				created_at: string;
				status: TeamSubmission["status"];
				sub: TeamSubmission;
		  };
	const entries: Entry[] = [
		...submissions.map<Entry>((s) => ({
			kind: "solo",
			created_at: s.created_at,
			status: s.status,
			sub: s,
		})),
		...teamSubmissions.map<Entry>((s) => ({
			kind: "team",
			created_at: s.created_at,
			status: s.status,
			sub: s,
		})),
	].sort((a, b) => b.created_at.localeCompare(a.created_at));
	const visible = entries.filter((e) =>
		filter === "all" ? true : e.status === "pending",
	);

	async function approveSolo(id: string) {
		setBusy(true);
		setMsg(null);
		const res = await fetch(`/api/player-submissions/${id}/approve`, {
			method: "POST",
		});
		const json = await res.json().catch(() => ({}));
		setBusy(false);
		if (!res.ok) {
			setMsg({ kind: "err", text: json.message ?? "Kunne ikke godkjenne." });
		} else {
			setMsg({ kind: "ok", text: "Spiller godkjent — magisk lenke sendt." });
			router.refresh();
		}
	}

	async function rejectSolo(id: string) {
		const reason =
			window.prompt(
				"Valgfri begrunnelse for avvisning (kun synlig for administratorer):",
			) ?? "";
		setBusy(true);
		setMsg(null);
		const res = await fetch(`/api/player-submissions/${id}/reject`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reason: reason || null }),
		});
		const json = await res.json().catch(() => ({}));
		setBusy(false);
		if (!res.ok) {
			setMsg({ kind: "err", text: json.message ?? "Kunne ikke avvise." });
		} else {
			setMsg({ kind: "ok", text: "Påmelding avvist." });
			router.refresh();
		}
	}

	async function approveTeam(id: string) {
		setBusy(true);
		setMsg(null);
		const res = await fetch(`/api/team-submissions/${id}/approve`, {
			method: "POST",
		});
		const json = await res.json().catch(() => ({}));
		setBusy(false);
		if (!res.ok) {
			setMsg({ kind: "err", text: json.message ?? "Kunne ikke godkjenne." });
		} else {
			setMsg({
				kind: "ok",
				text: "Lag godkjent — magiske lenker sendt til begge spillerne.",
			});
			router.refresh();
		}
	}

	async function rejectTeam(id: string) {
		const reason =
			window.prompt(
				"Valgfri begrunnelse for avvisning (kun synlig for administratorer):",
			) ?? "";
		setBusy(true);
		setMsg(null);
		const res = await fetch(`/api/team-submissions/${id}/reject`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reason: reason || null }),
		});
		const json = await res.json().catch(() => ({}));
		setBusy(false);
		if (!res.ok) {
			setMsg({ kind: "err", text: json.message ?? "Kunne ikke avvise." });
		} else {
			setMsg({ kind: "ok", text: "Lagpåmelding avvist." });
			router.refresh();
		}
	}

	return (
		<div className="mt-4 space-y-3">
			<div className="flex gap-2">
				{(["pending", "all"] as const).map((f) => (
					<button
						type="button"
						key={f}
						onClick={() => setFilter(f)}
						className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${
							filter === f ? "bg-ink text-cream" : "bg-cream-50"
						}`}
					>
						{f === "pending" ? "Avventer" : "Alle"}
					</button>
				))}
			</div>

			{visible.length === 0 && (
				<div className="card p-6 text-center text-ink/60">
					{filter === "pending"
						? "Ingen påmeldinger venter."
						: "Ingen påmeldinger enda."}
				</div>
			)}

			{visible.map((e) =>
				e.kind === "solo" ? (
					<SubmissionCard
						key={`solo-${e.sub.id}`}
						sub={e.sub}
						busy={busy}
						onApprove={() => approveSolo(e.sub.id)}
						onReject={() => rejectSolo(e.sub.id)}
					/>
				) : (
					<TeamSubmissionCard
						key={`team-${e.sub.id}`}
						sub={e.sub}
						busy={busy}
						onApprove={() => approveTeam(e.sub.id)}
						onReject={() => rejectTeam(e.sub.id)}
					/>
				),
			)}
		</div>
	);
}

function TeamSubmissionCard({
	sub,
	busy,
	onApprove,
	onReject,
}: {
	sub: TeamSubmission;
	busy: boolean;
	onApprove: () => void;
	onReject: () => void;
}) {
	const [open, setOpen] = useState(false);
	const players = [
		{
			label: "Spiller 1",
			first_name: sub.player_1_first_name,
			last_name: sub.player_1_last_name,
			nickname: sub.player_1_nickname,
			email: sub.player_1_email,
			bio: sub.player_1_bio,
			avatar_url: sub.player_1_avatar_url,
			experience: sub.player_1_experience,
		},
		{
			label: "Spiller 2",
			first_name: sub.player_2_first_name,
			last_name: sub.player_2_last_name,
			nickname: sub.player_2_nickname,
			email: sub.player_2_email,
			bio: sub.player_2_bio,
			avatar_url: sub.player_2_avatar_url,
			experience: sub.player_2_experience,
		},
	];

	return (
		<div className="card p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-start gap-3">
					<Avatar
						src={sub.team_avatar_url}
						name={sub.team_name}
						kind="team"
						size={44}
					/>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<KindBadge kind="team" />
							<p className="truncate text-lg font-extrabold">{sub.team_name}</p>
							<SubStatusBadge status={sub.status} />
						</div>
						<p className="mt-0.5 text-xs text-ink/60">
							{new Date(sub.created_at).toLocaleString()}
						</p>
						{sub.team_bio && (
							<p className="mt-2 text-sm text-ink/80">{sub.team_bio}</p>
						)}
					</div>
				</div>
			</div>

			<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
				{players.map((p) => {
					const fullName = `${p.first_name} ${p.last_name}`.trim();
					const display = p.nickname ? `${fullName} (${p.nickname})` : fullName;
					return (
						<div
							key={p.label}
							className="flex items-start gap-3 rounded-xl border-2 border-ink bg-cream-50 p-3"
						>
							<Avatar
								src={p.avatar_url}
								name={fullName || p.label}
								kind="player"
								size={36}
							/>
							<div className="min-w-0 flex-1">
								<p className="text-[10px] font-bold uppercase tracking-wider text-ink/60">
									{p.label}
								</p>
								<p className="mt-0.5 truncate text-sm font-extrabold">
									{display}
								</p>
								<p className="truncate text-xs text-ink/60">{p.email}</p>
								{p.bio && <p className="mt-1 text-xs text-ink/75">{p.bio}</p>}
							</div>
						</div>
					);
				})}
			</div>

			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="mt-3 text-xs font-bold underline opacity-70 hover:opacity-100"
			>
				{open ? "Skjul ferdighetsnivåer" : "Vis ferdighetsnivåer"}
			</button>

			{open && (
				<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
					{players.map((p) => (
						<ul key={p.label} className="space-y-1 text-xs">
							<li className="font-bold opacity-70">{p.label}</li>
							{SPORTS.map((s) => (
								<li
									key={s.key}
									className="flex justify-between rounded-lg border-2 border-ink bg-cream-50 px-2 py-1"
								>
									<span>
										{s.emoji} {s.label}
									</span>
									<span className="font-bold">
										{experienceLabel(p.experience?.[s.key])}
									</span>
								</li>
							))}
						</ul>
					))}
				</div>
			)}

			{sub.status === "pending" && (
				<div className="mt-4 flex flex-col gap-2 sm:flex-row">
					<button
						type="button"
						onClick={onApprove}
						disabled={busy}
						className="btn btn-primary flex-1 disabled:opacity-50"
					>
						Godkjenn og inviter
					</button>
					<button
						type="button"
						onClick={onReject}
						disabled={busy}
						className="btn btn-secondary flex-1 disabled:opacity-50"
					>
						Avvis
					</button>
				</div>
			)}

			{sub.status === "rejected" && sub.rejection_reason && (
				<p className="mt-3 text-xs text-terracotta-dark">
					Begrunnelse: {sub.rejection_reason}
				</p>
			)}
		</div>
	);
}

function SubmissionCard({
	sub,
	busy,
	onApprove,
	onReject,
}: {
	sub: PlayerSubmission;
	busy: boolean;
	onApprove: () => void;
	onReject: () => void;
}) {
	const [open, setOpen] = useState(false);
	const fullName = `${sub.first_name} ${sub.last_name}`.trim();
	const displayName = sub.nickname ? `${fullName} (${sub.nickname})` : fullName;
	return (
		<div className="card p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-start gap-3">
					<Avatar
						src={sub.avatar_url}
						name={fullName || sub.email}
						kind="player"
						size={44}
					/>
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<KindBadge kind="solo" />
							<p className="truncate text-lg font-extrabold">{displayName}</p>
							<SubStatusBadge status={sub.status} />
						</div>
						<p className="mt-0.5 text-xs text-ink/60">{sub.email}</p>
						<p className="mt-0.5 text-xs text-ink/60">
							{new Date(sub.created_at).toLocaleString()}
						</p>
						{sub.bio && <p className="mt-2 text-sm text-ink/80">{sub.bio}</p>}
					</div>
				</div>
			</div>

			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="mt-3 text-xs font-bold underline opacity-70 hover:opacity-100"
			>
				{open ? "Skjul ferdighetsnivåer" : "Vis ferdighetsnivåer"}
			</button>

			{open && (
				<ul className="mt-3 grid grid-cols-2 gap-1 text-xs">
					{SPORTS.map((s) => (
						<li
							key={s.key}
							className="flex justify-between rounded-lg border-2 border-ink bg-cream-50 px-2 py-1"
						>
							<span>
								{s.emoji} {s.label}
							</span>
							<span className="font-bold">
								{experienceLabel(sub.experience?.[s.key])}
							</span>
						</li>
					))}
				</ul>
			)}

			{sub.status === "pending" && (
				<div className="mt-4 flex flex-col gap-2 sm:flex-row">
					<button
						type="button"
						onClick={onApprove}
						disabled={busy}
						className="btn btn-primary flex-1 disabled:opacity-50"
					>
						Godkjenn og inviter
					</button>
					<button
						type="button"
						onClick={onReject}
						disabled={busy}
						className="btn btn-secondary flex-1 disabled:opacity-50"
					>
						Avvis
					</button>
				</div>
			)}

			{sub.status === "rejected" && sub.rejection_reason && (
				<p className="mt-3 text-xs text-terracotta-dark">
					Begrunnelse: {sub.rejection_reason}
				</p>
			)}
		</div>
	);
}

function KindBadge({ kind }: { kind: "solo" | "team" }) {
	const styles =
		kind === "team" ? "bg-teal text-cream" : "bg-cream-200 text-ink";
	return (
		<span
			className={`rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}
		>
			{kind === "team" ? "Lag" : "Spiller"}
		</span>
	);
}

function SubStatusBadge({ status }: { status: PlayerSubmission["status"] }) {
	const styles =
		status === "approved"
			? "bg-teal text-cream"
			: status === "rejected"
				? "bg-terracotta text-cream"
				: "bg-mustard";
	const labels: Record<PlayerSubmission["status"], string> = {
		approved: "Godkjent",
		rejected: "Avvist",
		pending: "Avventer",
	};
	return (
		<span
			className={`rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}
		>
			{labels[status] ?? status}
		</span>
	);
}

function RoleBadge({ role }: { role: UserRole }) {
	const styles =
		role === "super_admin"
			? "bg-plum text-cream"
			: role === "admin"
				? "bg-mustard"
				: "bg-cream-50";
	const labels: Record<UserRole, string> = {
		super_admin: "Superadmin",
		admin: "Admin",
		player: "Spiller",
	};
	return (
		<span
			className={`rounded-full border-2 border-ink px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}
		>
			{labels[role] ?? role}
		</span>
	);
}
