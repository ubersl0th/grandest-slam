"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  Team,
  Tournament,
  UserRole,
  Sport,
} from "@/lib/database.types";
import { sportEmoji, sportLabel } from "@/lib/sports";

type Section = "overview" | "teams" | "schedule" | "results" | "admins";

type Props = {
  isSuperAdmin: boolean;
  tournament: Tournament | null;
  teams: Team[];
  profiles: Profile[];
  matches: unknown[];
  flights: unknown[];
};

export function AdminConsole(props: Props) {
  const [section, setSection] = useState<Section>("overview");
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

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

  const tabs: { key: Section; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "teams", label: "Teams" },
    { key: "schedule", label: "Schedule" },
    { key: "results", label: "Results" },
    ...(props.isSuperAdmin ? [{ key: "admins" as const, label: "Admins" }] : []),
  ];

  return (
    <div className="mt-6">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSection(t.key)}
            className={`shrink-0 rounded-full border-2 border-[var(--color-ink)] px-4 py-1.5 text-sm font-bold transition ${
              section === t.key
                ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div
          className={`card mt-4 p-3 text-sm font-bold ${
            msg.kind === "ok"
              ? "border-[var(--color-teal)] bg-[var(--color-teal)]/10 text-[var(--color-teal-dark)]"
              : "border-[var(--color-terracotta)] bg-[var(--color-terracotta)]/10 text-[var(--color-terracotta-dark)]"
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
          onStart={() => action(() => supabase.rpc("start_tournament"), "Tournament started.")}
          onEnd={() => action(() => supabase.rpc("end_tournament"), "Tournament ended.")}
          onGenerateRoundRobin={() =>
            action(
              () => supabase.rpc("generate_round_robin"),
              "Round-robin schedule generated for Padel and Tennis.",
            )
          }
        />
      )}

      {section === "teams" && (
        <TeamsPanel teams={props.teams} profiles={props.profiles} busy={busy} action={action} supabase={supabase} />
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

      {section === "admins" && props.isSuperAdmin && (
        <AdminsPanel profiles={props.profiles} busy={busy} action={action} supabase={supabase} />
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
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]/60">
              Status
            </p>
            <p
              className="mt-1 text-3xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {labelFor(status)}
            </p>
            <p className="mt-1 text-sm text-[var(--color-ink)]/70">
              {teamCount} team{teamCount === 1 ? "" : "s"} signed up
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {status !== "active" && (
              <button onClick={onStart} disabled={busy || teamCount < 2} className="btn btn-primary disabled:opacity-50">
                Start tournament
              </button>
            )}
            {status === "active" && (
              <button onClick={onEnd} disabled={busy} className="btn btn-secondary disabled:opacity-50">
                End tournament
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Teams" value={teamCount} />
        <Stat label="Matches" value={matchStats.total} />
        <Stat label="Pending" value={matchStats.pending + flightStats.pending} />
        <Stat label="Confirmed" value={matchStats.confirmed + flightStats.confirmed} />
      </div>

      <div className="card p-5">
        <h3 className="text-lg font-extrabold">Setup actions</h3>
        <p className="mt-1 text-sm text-[var(--color-ink)]/70">
          Generate the Padel + Tennis round-robin once teams have signed up. Add flights for Disc
          Golf and Golf in the Schedule tab.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onGenerateRoundRobin} disabled={busy || teamCount < 2} className="btn btn-secondary disabled:opacity-50">
            Generate round-robin (Padel & Tennis)
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]/60">
        {label}
      </p>
      <p className="mt-1 text-3xl" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
    </div>
  );
}

function labelFor(s: string) {
  return s
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
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
  busy,
  action,
  supabase,
}: {
  teams: Team[];
  profiles: Profile[];
  busy: boolean;
  action: ActionFn;
  supabase: SupabaseLike;
}) {
  return (
    <div className="mt-4 space-y-2">
      {teams.length === 0 && (
        <div className="card p-6 text-center text-[var(--color-ink)]/60">
          No teams yet.
        </div>
      )}
      {teams.map((t) => (
        <TeamRow
          key={t.id}
          team={t}
          profiles={profiles}
          busy={busy}
          onDelete={() =>
            action(
              async () => {
                if (!window.confirm(`Delete team "${t.name}"?`)) return { error: null };
                return supabase.from("teams").delete().eq("id", t.id);
              },
              `Deleted ${t.name}.`,
            )
          }
          onRename={(name) =>
            action(
              async () => supabase.from("teams").update({ name }).eq("id", t.id),
              `Renamed.`,
            )
          }
        />
      ))}
    </div>
  );
}

function TeamRow({
  team,
  busy,
  onDelete,
  onRename,
}: {
  team: Team;
  profiles: Profile[];
  busy: boolean;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name !== team.name) onRename(name);
              setEditing(false);
            }}
            autoFocus
          />
        ) : (
          <Link
            href={`/teams/${team.id}`}
            className="block truncate font-extrabold hover:underline"
          >
            {team.name}
          </Link>
        )}
        {team.bio && <p className="mt-0.5 text-xs text-[var(--color-ink)]/60">{team.bio}</p>}
      </div>
      <button onClick={() => setEditing((e) => !e)} className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-3 py-1 text-xs font-bold">
        {editing ? "Cancel" : "Rename"}
      </button>
      <button
        onClick={onDelete}
        disabled={busy}
        className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-terracotta)] px-3 py-1 text-xs font-bold text-[var(--color-cream)] disabled:opacity-50"
      >
        Delete
      </button>
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
        <h3 className="text-lg font-extrabold">Add flight</h3>
        <p className="mt-1 text-sm text-[var(--color-ink)]/70">
          Disc Golf and Golf flights pair two teams. Players play together in best ball; one stroke
          score per team.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Sport</span>
            <select
              className="input"
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
            >
              <option value="disc_golf">Disc Golf</option>
              <option value="golf">Golf</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Round</span>
            <select
              className="input"
              value={round}
              onChange={(e) => setRound(Number(e.target.value))}
            >
              <option value={1}>Round 1</option>
              <option value={2}>Round 2</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Team 1</span>
            <select className="input" value={t1} onChange={(e) => setT1(e.target.value)}>
              <option value="">— select —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Team 2</span>
            <select className="input" value={t2} onChange={(e) => setT2(e.target.value)}>
              <option value="">— select —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
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
              "Flight added.",
            )
          }
          className="btn btn-primary mt-4 disabled:opacity-50"
        >
          Add flight
        </button>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-extrabold">Existing flights</h3>
        <div className="space-y-2">
          {flights.length === 0 && (
            <div className="card p-4 text-center text-sm text-[var(--color-ink)]/60">
              No flights yet.
            </div>
          )}
          {(flights as FlightWithTeams[]).map((f) => (
            <FlightRow
              key={f.id}
              flight={f}
              busy={busy}
              onDelete={() =>
                action(
                  async () => {
                    if (!window.confirm("Delete this flight?")) return { error: null };
                    return supabase.from("flights").delete().eq("id", f.id);
                  },
                  "Flight deleted.",
                )
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
  status: string | null;
  t1: { name: string } | { name: string }[] | null;
  t2: { name: string } | { name: string }[] | null;
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
  const t1 = Array.isArray(flight.t1) ? flight.t1[0]?.name : flight.t1?.name;
  const t2 = Array.isArray(flight.t2) ? flight.t2[0]?.name : flight.t2?.name;
  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]/60">
          {sportEmoji(flight.sport)} {sportLabel(flight.sport)} · R{flight.round_number}
        </p>
        <p className="mt-1 truncate font-extrabold">
          {t1} <span className="opacity-50">vs</span> {t2}
        </p>
      </div>
      <Link
        href={`/matches/flight/${flight.id}`}
        className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-3 py-1 text-xs font-bold"
      >
        Open
      </Link>
      <button
        onClick={onDelete}
        disabled={busy}
        className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-terracotta)] px-3 py-1 text-xs font-bold text-[var(--color-cream)] disabled:opacity-50"
      >
        Delete
      </button>
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
  type MatchRow = {
    id: string;
    sport: Sport;
    score_a: number | null;
    score_b: number | null;
    status: string | null;
    ta: { name: string } | { name: string }[] | null;
    tb: { name: string } | { name: string }[] | null;
  };
  const allMatches = matches as MatchRow[];
  const allFlights = flights as FlightWithTeams[];

  return (
    <div className="mt-4 space-y-2">
      {allMatches.length === 0 && allFlights.length === 0 && (
        <div className="card p-6 text-center text-[var(--color-ink)]/60">
          No results yet.
        </div>
      )}
      {allMatches.map((m) => (
        <Link
          key={m.id}
          href={`/matches/${m.id}`}
          className="card flex items-center gap-3 p-3 hover:translate-y-[-1px] transition-transform"
        >
          <span className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-2 py-0.5 text-[10px] font-black uppercase">
            {sportLabel(m.sport)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-extrabold">
              {Array.isArray(m.ta) ? m.ta[0]?.name : m.ta?.name} vs{" "}
              {Array.isArray(m.tb) ? m.tb[0]?.name : m.tb?.name}
            </p>
            <p className="text-xs text-[var(--color-ink)]/60">
              {m.status === "confirmed"
                ? `Final ${m.score_a}–${m.score_b}`
                : m.status === "pending"
                  ? `Pending ${m.score_a}–${m.score_b}`
                  : m.status === "disputed"
                    ? "Disputed"
                    : "Not played"}
            </p>
          </div>
        </Link>
      ))}
      {allFlights.map((f) => (
        <Link
          key={f.id}
          href={`/matches/flight/${f.id}`}
          className="card flex items-center gap-3 p-3 hover:translate-y-[-1px] transition-transform"
        >
          <span className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-2 py-0.5 text-[10px] font-black uppercase">
            {sportLabel(f.sport)} R{f.round_number}
          </span>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-extrabold">
              {Array.isArray(f.t1) ? f.t1[0]?.name : f.t1?.name} vs{" "}
              {Array.isArray(f.t2) ? f.t2[0]?.name : f.t2?.name}
            </p>
          </div>
        </Link>
      ))}
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
      <p className="text-sm text-[var(--color-ink)]/70">
        Promote players to admin so they can manage teams and resolve disputes. Super-admin is
        immutable from the UI.
      </p>
      {profiles.map((p) => (
        <div key={p.id} className="card flex items-center gap-3 p-3">
          <div className="flex-1 min-w-0">
            <p className="truncate font-extrabold">{p.full_name}</p>
            <p className="text-xs text-[var(--color-ink)]/60">{p.email}</p>
          </div>
          <RoleBadge role={p.role} />
          {p.role !== "super_admin" && (
            <select
              disabled={busy}
              value={p.role}
              onChange={(e) =>
                action(
                  async () => {
                    const { error } = await supabase.rpc("set_user_role", {
                      p_profile_id: p.id,
                      p_role: e.target.value as UserRole,
                    });
                    return { error };
                  },
                  `Updated ${p.full_name}.`,
                )
              }
              className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-2 py-1 text-xs font-bold"
            >
              <option value="player">Player</option>
              <option value="admin">Admin</option>
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles =
    role === "super_admin"
      ? "bg-[var(--color-plum)] text-[var(--color-cream)]"
      : role === "admin"
        ? "bg-[var(--color-mustard)]"
        : "bg-[var(--color-cream-50)]";
  return (
    <span
      className={`rounded-full border-2 border-[var(--color-ink)] px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}
    >
      {role.replace("_", " ")}
    </span>
  );
}
