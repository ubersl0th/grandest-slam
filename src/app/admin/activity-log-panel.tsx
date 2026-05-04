"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
	ActivityLog,
	Profile,
	Team,
	UserRole,
} from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

const ACTION_LABELS: Record<string, string> = {
	"profile.created": "Spiller opprettet",
	"profile.updated": "Profil oppdatert",
	"profile.role_changed": "Rolle endret",
	"experience.updated": "Ferdighetsnivå endret",
	"team.created": "Lag opprettet",
	"team.renamed": "Lag omdøpt",
	"team.updated": "Lag endret",
	"team.deleted": "Lag slettet",
	"team_member.added": "Spiller lagt til lag",
	"team_member.removed": "Spiller fjernet fra lag",
	"match.created": "Kamp opprettet",
	"match.submitted": "Kampresultat registrert",
	"match.confirmed": "Kampresultat bekreftet",
	"match.disputed": "Kampresultat bestridt",
	"match.updated": "Kamp endret",
	"match.deleted": "Kamp slettet",
	"flight.created": "Runde opprettet",
	"flight.submitted": "Runderesultat registrert",
	"flight.confirmed": "Runderesultat bekreftet",
	"flight.disputed": "Runderesultat bestridt",
	"flight.updated": "Runde endret",
	"flight.deleted": "Runde slettet",
	"submission.created": "Påmelding mottatt",
	"submission.approved": "Påmelding godkjent",
	"submission.rejected": "Påmelding avvist",
	"submission.deleted": "Påmelding slettet",
	"tournament.started": "Turnering startet",
	"tournament.ended": "Turnering avsluttet",
	"tournament.updated": "Turnering oppdatert",
	"schedule.generated": "Serieoppsett generert",
};

const TARGET_LABELS: Record<string, string> = {
	profile: "Spiller",
	team: "Lag",
	match: "Kamp",
	flight: "Runde",
	submission: "Påmelding",
	tournament: "Turnering",
};

const DATE_RANGES = [
	{ key: "all", label: "Hele tiden" },
	{ key: "today", label: "I dag" },
	{ key: "7d", label: "Siste 7 dager" },
	{ key: "30d", label: "Siste 30 dager" },
] as const;

type DateRange = (typeof DATE_RANGES)[number]["key"];

const PAGE_SIZE = 100;

type Props = {
	initial: ActivityLog[];
	teams: Team[];
	profiles: Profile[];
};

export function ActivityLogPanel({ initial, teams, profiles }: Props) {
	const supabase = useMemo(() => createClient(), []);
	const [entries, setEntries] = useState<ActivityLog[]>(initial);
	const [search, setSearch] = useState("");
	const [actor, setActor] = useState("all");
	const [action, setAction] = useState("all");
	const [targetType, setTargetType] = useState("all");
	const [team, setTeam] = useState("all");
	const [dateRange, setDateRange] = useState<DateRange>("all");
	const [visible, setVisible] = useState(PAGE_SIZE);
	const [live, setLive] = useState(true);
	const liveRef = useRef(live);
	liveRef.current = live;

	const teamsById = useMemo(() => {
		const m = new Map<string, Team>();
		for (const t of teams) m.set(t.id, t);
		return m;
	}, [teams]);
	const profilesById = useMemo(() => {
		const m = new Map<string, Profile>();
		for (const p of profiles) m.set(p.id, p);
		return m;
	}, [profiles]);

	useEffect(() => {
		const channel = supabase
			.channel("activity-log-feed")
			.on(
				"postgres_changes",
				{ event: "INSERT", schema: "public", table: "activity_log" },
				(payload) => {
					if (!liveRef.current) return;
					const row = payload.new as ActivityLog;
					setEntries((prev) =>
						prev.some((e) => e.id === row.id) ? prev : [row, ...prev],
					);
				},
			)
			.subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, [supabase]);

	const distinctActors = useMemo(() => {
		const seen = new Map<string, string>();
		for (const e of entries) {
			if (e.actor_id && !seen.has(e.actor_id)) {
				seen.set(e.actor_id, e.actor_name ?? e.actor_id);
			}
		}
		const list = Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
		list.sort((a, b) => a.name.localeCompare(b.name, "nb"));
		return list;
	}, [entries]);

	const distinctActions = useMemo(() => {
		const set = new Set<string>();
		for (const e of entries) set.add(e.action);
		return Array.from(set).sort((a, b) =>
			(ACTION_LABELS[a] ?? a).localeCompare(ACTION_LABELS[b] ?? b, "nb"),
		);
	}, [entries]);

	const distinctTargetTypes = useMemo(() => {
		const set = new Set<string>();
		for (const e of entries) if (e.target_type) set.add(e.target_type);
		return Array.from(set).sort((a, b) =>
			(TARGET_LABELS[a] ?? a).localeCompare(TARGET_LABELS[b] ?? b, "nb"),
		);
	}, [entries]);

	const dateCutoff = useMemo<number | null>(() => {
		const now = Date.now();
		switch (dateRange) {
			case "today": {
				const d = new Date();
				d.setHours(0, 0, 0, 0);
				return d.getTime();
			}
			case "7d":
				return now - 7 * 24 * 60 * 60 * 1000;
			case "30d":
				return now - 30 * 24 * 60 * 60 * 1000;
			default:
				return null;
		}
	}, [dateRange]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return entries.filter((e) => {
			if (actor !== "all" && e.actor_id !== actor) {
				if (actor === "system" && e.actor_id !== null) return false;
				if (actor !== "system") return false;
			}
			if (action !== "all" && e.action !== action) return false;
			if (targetType !== "all" && e.target_type !== targetType) return false;
			if (team !== "all") {
				const inTargets =
					e.team_ids.includes(team) ||
					(e.target_type === "team" && e.target_id === team);
				if (!inTargets) return false;
			}
			if (dateCutoff !== null && new Date(e.created_at).getTime() < dateCutoff)
				return false;
			if (q) {
				const haystack = [
					e.summary,
					e.action,
					ACTION_LABELS[e.action] ?? "",
					e.actor_name ?? "",
					e.actor_id ?? "",
					e.target_label ?? "",
					e.target_type ?? "",
					e.target_id ?? "",
					...e.team_ids,
					e.metadata ? JSON.stringify(e.metadata) : "",
				]
					.join(" ")
					.toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			return true;
		});
	}, [entries, search, actor, action, targetType, team, dateCutoff]);

	const visibleEntries = filtered.slice(0, visible);

	function clearFilters() {
		setSearch("");
		setActor("all");
		setAction("all");
		setTargetType("all");
		setTeam("all");
		setDateRange("all");
	}

	const hasFilters =
		!!search ||
		actor !== "all" ||
		action !== "all" ||
		targetType !== "all" ||
		team !== "all" ||
		dateRange !== "all";

	return (
		<div className="mt-4 space-y-4">
			<div className="card p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h3 className="text-lg font-extrabold">Aktivitetslogg</h3>
						<p className="text-xs text-ink/60">
							{filtered.length} av {entries.length} hendelser
							{live ? " · live" : " · pauset"}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setLive((v) => !v)}
							className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${
								live ? "bg-teal/15 text-ink" : "bg-cream-50"
							}`}
						>
							<span
								className={`mr-2 inline-block h-2 w-2 rounded-full ${
									live ? "animate-pulse bg-teal" : "bg-ink/30"
								}`}
							/>
							{live ? "Live" : "Pauset"}
						</button>
						{hasFilters && (
							<button
								type="button"
								onClick={clearFilters}
								className="rounded-full border-2 border-ink bg-cream-50 px-3 py-1 text-xs font-bold"
							>
								Nullstill filtre
							</button>
						)}
					</div>
				</div>

				<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<label className="block sm:col-span-2 lg:col-span-3">
						<span className="label">Søk (alt: navn, lag-id, fritekst…)</span>
						<input
							className="input"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Søk i logg…"
						/>
					</label>
					<label className="block">
						<span className="label">Bruker</span>
						<select
							className="input"
							value={actor}
							onChange={(e) => setActor(e.target.value)}
						>
							<option value="all">Alle brukere</option>
							<option value="system">Systemet</option>
							{distinctActors.map((a) => (
								<option key={a.id} value={a.id}>
									{a.name}
								</option>
							))}
						</select>
					</label>
					<label className="block">
						<span className="label">Handling</span>
						<select
							className="input"
							value={action}
							onChange={(e) => setAction(e.target.value)}
						>
							<option value="all">Alle handlinger</option>
							{distinctActions.map((a) => (
								<option key={a} value={a}>
									{ACTION_LABELS[a] ?? a}
								</option>
							))}
						</select>
					</label>
					<label className="block">
						<span className="label">Type</span>
						<select
							className="input"
							value={targetType}
							onChange={(e) => setTargetType(e.target.value)}
						>
							<option value="all">Alle typer</option>
							{distinctTargetTypes.map((t) => (
								<option key={t} value={t}>
									{TARGET_LABELS[t] ?? t}
								</option>
							))}
						</select>
					</label>
					<label className="block">
						<span className="label">Lag</span>
						<select
							className="input"
							value={team}
							onChange={(e) => setTeam(e.target.value)}
						>
							<option value="all">Alle lag</option>
							{teams.map((t) => (
								<option key={t.id} value={t.id}>
									{t.name}
								</option>
							))}
						</select>
					</label>
					<label className="block">
						<span className="label">Tidsrom</span>
						<select
							className="input"
							value={dateRange}
							onChange={(e) => setDateRange(e.target.value as DateRange)}
						>
							{DATE_RANGES.map((d) => (
								<option key={d.key} value={d.key}>
									{d.label}
								</option>
							))}
						</select>
					</label>
				</div>
			</div>

			<div className="space-y-2">
				{visibleEntries.length === 0 ? (
					<div className="card p-6 text-center text-ink/60">
						Ingen aktivitet å vise.
					</div>
				) : (
					visibleEntries.map((entry) => (
						<EntryRow
							key={entry.id}
							entry={entry}
							teamsById={teamsById}
							profilesById={profilesById}
						/>
					))
				)}
				{filtered.length > visibleEntries.length && (
					<button
						type="button"
						onClick={() => setVisible((v) => v + PAGE_SIZE)}
						className="btn btn-secondary w-full"
					>
						Vis flere ({filtered.length - visibleEntries.length} igjen)
					</button>
				)}
			</div>
		</div>
	);
}

function EntryRow({
	entry,
	teamsById,
	profilesById,
}: {
	entry: ActivityLog;
	teamsById: Map<string, Team>;
	profilesById: Map<string, Profile>;
}) {
	const [open, setOpen] = useState(false);
	const actorLabel = entry.actor_id
		? (profilesById.get(entry.actor_id)?.nickname ??
			profilesById.get(entry.actor_id)?.full_name ??
			entry.actor_name ??
			"Ukjent")
		: "Systemet";
	const actionLabel = ACTION_LABELS[entry.action] ?? entry.action;
	const targetLabel = entry.target_type
		? (TARGET_LABELS[entry.target_type] ?? entry.target_type)
		: null;
	const teamNames = entry.team_ids
		.map((id) => teamsById.get(id)?.name)
		.filter((n): n is string => !!n);

	return (
		<div className="card p-3">
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-full border-2 border-ink bg-cream-50 px-2 py-0.5 text-[10px] font-black uppercase">
							{actionLabel}
						</span>
						{targetLabel && (
							<span className="rounded-full border-2 border-ink bg-cream/50 px-2 py-0.5 text-[10px] font-black uppercase opacity-70">
								{targetLabel}
							</span>
						)}
						{entry.actor_role && <ActorRoleBadge role={entry.actor_role} />}
					</div>
					<p className="mt-1 text-sm font-extrabold leading-snug">
						{entry.summary}
					</p>
					<p className="mt-1 text-[11px] text-ink/60">
						<span className="font-bold">{actorLabel}</span>
						{teamNames.length > 0 && (
							<>
								{" · "}
								{teamNames.join(", ")}
							</>
						)}
						{" · "}
						<time
							dateTime={entry.created_at}
							title={fullTime(entry.created_at)}
						>
							{relativeTime(entry.created_at)}
						</time>
					</p>
				</div>
				{entry.metadata && Object.keys(entry.metadata).length > 0 && (
					<button
						type="button"
						onClick={() => setOpen((o) => !o)}
						className="rounded-full border-2 border-ink bg-cream-50 px-2 py-0.5 text-[10px] font-bold"
					>
						{open ? "Skjul" : "Detaljer"}
					</button>
				)}
			</div>
			{open && entry.metadata && (
				<pre className="mt-2 overflow-x-auto rounded-lg border-2 border-ink bg-cream-50 p-2 text-[11px]">
					{JSON.stringify(entry.metadata, null, 2)}
				</pre>
			)}
		</div>
	);
}

function ActorRoleBadge({ role }: { role: UserRole }) {
	const styles =
		role === "super_admin"
			? "bg-plum text-cream"
			: role === "admin"
				? "bg-mustard"
				: "bg-cream-50";
	const label =
		role === "super_admin"
			? "Superadmin"
			: role === "admin"
				? "Admin"
				: "Spiller";
	return (
		<span
			className={`rounded-full border-2 border-ink px-2 py-0.5 text-[9px] font-black uppercase ${styles}`}
		>
			{label}
		</span>
	);
}

function fullTime(iso: string) {
	return new Date(iso).toLocaleString("nb-NO");
}

function relativeTime(iso: string) {
	const diffMs = Date.now() - new Date(iso).getTime();
	const sec = Math.round(diffMs / 1000);
	if (sec < 30) return "akkurat nå";
	if (sec < 60) return `${sec} sek siden`;
	const min = Math.round(sec / 60);
	if (min < 60) return `${min} min siden`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr} t siden`;
	const day = Math.round(hr / 24);
	if (day < 7) return `${day} d siden`;
	return new Date(iso).toLocaleDateString("nb-NO");
}
