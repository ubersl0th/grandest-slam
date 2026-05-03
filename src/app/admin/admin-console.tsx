"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type {
  Profile,
  Team,
  TeamMember,
  PlayerExperience,
  PlayerSubmission,
  Tournament,
  UserRole,
  Sport,
  ExperienceLevel,
} from "@/lib/database.types";
import { EXPERIENCE_WEIGHTS, SPORTS, sportEmoji, sportLabel } from "@/lib/sports";
import {
  generateBalancedTeams,
  type BalancePlayer,
  type BalanceResult,
} from "@/lib/team-balancer";

type Section = "overview" | "submissions" | "teams" | "schedule" | "results" | "admins";

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

  const pendingCount = props.submissions.filter((s) => s.status === "pending").length;
  const tabs: { key: Section; label: string; badge?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "submissions", label: "Submissions", badge: pendingCount || undefined },
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
            {t.badge ? (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-terracotta)] px-1.5 text-[11px] font-black text-[var(--color-cream)]">
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

      {section === "submissions" && (
        <SubmissionsPanel
          submissions={props.submissions}
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
      const input: BalancePlayer[] = unassigned.map((p) => ({
        id: p.id,
        experience: experienceByProfile.get(p.id)!,
      }));
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
        const candidate = `Team ${counter++}`;
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
        setApplyError(teamErr?.message ?? "Could not create team.");
        router.refresh();
        return;
      }
      const teamRow = team as Team;
      const { error: memberErr } = await supabase
        .from("team_members")
        .insert([
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
      `Created ${name}.`,
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold">Roster</h3>
            <p className="mt-1 text-sm text-[var(--color-ink)]/70">
              {unassigned.length} unassigned · {teams.length} team
              {teams.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={generatePreview}
              disabled={busy || generating || unassigned.length < 2}
              className="btn btn-primary disabled:opacity-50"
            >
              {generating ? "Crunching…" : "Auto-generate teams"}
            </button>
            <button
              onClick={createEmptyTeam}
              disabled={busy}
              className="btn btn-secondary disabled:opacity-50"
            >
              Add empty team
            </button>
          </div>
        </div>

        {unassigned.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]/60">
              Unassigned players
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
                      `Added ${p.full_name} to team.`,
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {applyError && (
        <div className="card border-[var(--color-terracotta)] bg-[var(--color-terracotta)]/10 p-3 text-sm font-bold text-[var(--color-terracotta-dark)]">
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
          <div className="card p-6 text-center text-[var(--color-ink)]/60">
            No teams yet.
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
              action(
                async () => {
                  if (!window.confirm(`Delete team "${t.name}"?`))
                    return { error: null };
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
            onAddMember={(profileId) =>
              action(
                async () =>
                  supabase
                    .from("team_members")
                    .insert({ team_id: t.id, profile_id: profileId }),
                "Added to team.",
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
                "Removed from team.",
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
  const eligibleTeams = teams.filter((t) => (rosters.get(t.id)?.length ?? 0) < 2);
  const total = experience
    ? SPORTS.reduce((acc, s) => acc + (EXPERIENCE_WEIGHTS[experience[s.key]] ?? 0), 0)
    : 0;
  return (
    <div className="rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] p-2">
      <p className="text-sm font-extrabold">
        {profile.nickname || profile.full_name}
      </p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink)]/60">
        skill {total}
      </p>
      {eligibleTeams.length > 0 && (
        <select
          disabled={busy}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onAssign(e.target.value);
          }}
          className="mt-1 w-full rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-2 py-1 text-[11px] font-bold"
        >
          <option value="">Add to team…</option>
          {eligibleTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
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
    <div className="card border-[var(--color-teal)] bg-[var(--color-teal)]/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold">Proposed pairings</h3>
          <p className="mt-1 text-sm text-[var(--color-ink)]/70">
            Per-sport pair-skill spread (lower = more balanced):
          </p>
          <ul className="mt-1 flex flex-wrap gap-2 text-xs">
            {SPORTS.map((s) => (
              <li
                key={s.key}
                className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-2 py-0.5"
              >
                {s.emoji} {s.label}: {preview.perSportSpread[s.key].min}–
                {preview.perSportSpread[s.key].max}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onApply}
            disabled={busy}
            className="btn btn-primary disabled:opacity-50"
          >
            Apply pairings
          </button>
          <button
            onClick={onRegenerate}
            disabled={busy}
            className="btn btn-secondary disabled:opacity-50"
          >
            Re-roll
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-4 py-2 text-sm font-bold disabled:opacity-50"
          >
            Cancel
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
              key={idx}
              className="rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] p-3"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]/60">
                Team {idx + 1}
              </p>
              <p className="mt-0.5 text-base font-extrabold">
                {a?.nickname || a?.full_name} <span className="opacity-50">+</span>{" "}
                {b?.nickname || b?.full_name}
              </p>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-ink)]/70">
                {SPORTS.map((s) => (
                  <li key={s.key}>
                    {s.emoji} {(EXPERIENCE_WEIGHTS[expA?.[s.key] ?? "beginner"] +
                      EXPERIENCE_WEIGHTS[expB?.[s.key] ?? "beginner"])}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {preview.unassigned && (
          <div className="rounded-xl border-2 border-dashed border-[var(--color-ink)] bg-[var(--color-cream-50)] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]/60">
              Unassigned (odd number of players)
            </p>
            <p className="mt-0.5 font-extrabold">
              {profilesById.get(preview.unassigned.id)?.nickname ||
                profilesById.get(preview.unassigned.id)?.full_name}
            </p>
          </div>
        )}
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
    <div className="card p-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name !== team.name && name.trim().length >= 2) onRename(name.trim());
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
          {team.bio && (
            <p className="mt-0.5 text-xs text-[var(--color-ink)]/60">{team.bio}</p>
          )}
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-3 py-1 text-xs font-bold"
        >
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

      <div className="mt-3 space-y-1">
        {members.length === 0 && (
          <p className="text-xs italic text-[var(--color-ink)]/60">No members.</p>
        )}
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-2 rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-3 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">
                {m.nickname || m.full_name}
              </p>
              <p className="truncate text-[10px] text-[var(--color-ink)]/60">
                {m.email}
              </p>
            </div>
            <button
              onClick={() => onRemoveMember(m.id)}
              disabled={busy}
              className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-2 py-0.5 text-[10px] font-bold disabled:opacity-50"
            >
              Remove
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
            className="w-full rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-cream)] px-2 py-1 text-xs font-bold"
          >
            <option value="">Add player…</option>
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

function SubmissionsPanel({
  submissions,
  busy,
  setBusy,
  setMsg,
  router,
}: {
  submissions: PlayerSubmission[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  setMsg: (m: { kind: "ok" | "err"; text: string } | null) => void;
  router: ReturnType<typeof useRouter>;
}) {
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const list = submissions.filter((s) => (filter === "all" ? true : s.status === "pending"));

  async function approve(id: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/player-submissions/${id}/approve`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: json.message ?? "Could not approve." });
    } else {
      setMsg({ kind: "ok", text: "Player approved — magic link sent." });
      router.refresh();
    }
  }

  async function reject(id: string) {
    const reason = window.prompt("Optional rejection reason (visible to admins only):") ?? "";
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
      setMsg({ kind: "err", text: json.message ?? "Could not reject." });
    } else {
      setMsg({ kind: "ok", text: "Submission rejected." });
      router.refresh();
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex gap-2">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border-2 border-[var(--color-ink)] px-3 py-1 text-xs font-bold ${
              filter === f
                ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                : "bg-[var(--color-cream-50)]"
            }`}
          >
            {f === "pending" ? "Pending" : "All"}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="card p-6 text-center text-[var(--color-ink)]/60">
          {filter === "pending" ? "No pending submissions." : "No submissions yet."}
        </div>
      )}

      {list.map((s) => (
        <SubmissionCard
          key={s.id}
          sub={s}
          busy={busy}
          onApprove={() => approve(s.id)}
          onReject={() => reject(s.id)}
        />
      ))}
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-lg font-extrabold">{displayName}</p>
            <SubStatusBadge status={sub.status} />
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-ink)]/60">{sub.email}</p>
          <p className="mt-0.5 text-xs text-[var(--color-ink)]/60">
            {new Date(sub.created_at).toLocaleString()}
          </p>
          {sub.bio && (
            <p className="mt-2 text-sm text-[var(--color-ink)]/80">{sub.bio}</p>
          )}
        </div>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-xs font-bold underline opacity-70 hover:opacity-100"
      >
        {open ? "Hide skill levels" : "Show skill levels"}
      </button>

      {open && (
        <ul className="mt-3 grid grid-cols-2 gap-1 text-xs">
          {SPORTS.map((s) => (
            <li
              key={s.key}
              className="flex justify-between rounded-lg border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-2 py-1"
            >
              <span>
                {s.emoji} {s.label}
              </span>
              <span className="font-bold capitalize">
                {sub.experience?.[s.key] ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {sub.status === "pending" && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={onApprove}
            disabled={busy}
            className="btn btn-primary flex-1 disabled:opacity-50"
          >
            Approve & invite
          </button>
          <button
            onClick={onReject}
            disabled={busy}
            className="btn btn-secondary flex-1 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {sub.status === "rejected" && sub.rejection_reason && (
        <p className="mt-3 text-xs text-[var(--color-terracotta-dark)]">
          Reason: {sub.rejection_reason}
        </p>
      )}
    </div>
  );
}

function SubStatusBadge({ status }: { status: PlayerSubmission["status"] }) {
  const styles =
    status === "approved"
      ? "bg-[var(--color-teal)] text-[var(--color-cream)]"
      : status === "rejected"
        ? "bg-[var(--color-terracotta)] text-[var(--color-cream)]"
        : "bg-[var(--color-mustard)]";
  return (
    <span
      className={`rounded-full border-2 border-[var(--color-ink)] px-2 py-0.5 text-[10px] font-black uppercase ${styles}`}
    >
      {status}
    </span>
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
