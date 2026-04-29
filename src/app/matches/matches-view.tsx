"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sportEmoji, sportLabel } from "@/lib/sports";
import type { Sport, SubmissionStatus } from "@/lib/database.types";

type RawMatch = {
  id: string;
  sport: Sport;
  team_a: string;
  team_b: string;
  score_a: number | null;
  score_b: number | null;
  winner_team_id: string | null;
  status: SubmissionStatus | null;
  ta: { name: string } | { name: string }[] | null;
  tb: { name: string } | { name: string }[] | null;
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
  t1: { name: string } | { name: string }[] | null;
  t2: { name: string } | { name: string }[] | null;
};

const tabs: { key: "all" | "mine" | Sport; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "My team" },
  { key: "padel", label: "Padel" },
  { key: "tennis", label: "Tennis" },
  { key: "disc_golf", label: "Disc Golf" },
  { key: "golf", label: "Golf" },
];

function getName(rel: { name: string } | { name: string }[] | null) {
  if (!rel) return "?";
  return Array.isArray(rel) ? (rel[0]?.name ?? "?") : rel.name;
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
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>(myTeamId ? "mine" : "all");

  useEffect(() => {
    const supabase = createClient();
    async function refresh() {
      const [m, f] = await Promise.all([
        supabase.from("matches").select("*, ta:team_a(name), tb:team_b(name)").order("created_at", { ascending: false }),
        supabase.from("flights").select("*, t1:team_1(name), t2:team_2(name)").order("round_number").order("created_at", { ascending: false }),
      ]);
      if (m.data) setMatches(m.data as RawMatch[]);
      if (f.data) setFlights(f.data as RawFlight[]);
    }
    const channel = supabase
      .channel("matches-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "flights" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredMatches = matches.filter((m) => {
    if (tab === "all") return true;
    if (tab === "mine") return myTeamId && (m.team_a === myTeamId || m.team_b === myTeamId);
    return m.sport === tab;
  });
  const filteredFlights = flights.filter((f) => {
    if (tab === "all") return true;
    if (tab === "mine") return myTeamId && (f.team_1 === myTeamId || f.team_2 === myTeamId);
    return f.sport === tab;
  });

  // Sort by status priority: pending (needs me to confirm) → not started → confirmed
  const matchPriority = (m: RawMatch) => {
    if (m.status === "pending") return 0;
    if (m.status === null) return 1;
    if (m.status === "disputed") return 2;
    return 3;
  };
  filteredMatches.sort((a, b) => matchPriority(a) - matchPriority(b));
  filteredFlights.sort((a, b) => matchPriority(a as unknown as RawMatch) - matchPriority(b as unknown as RawMatch));

  return (
    <div className="mt-6">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            disabled={t.key === "mine" && !myTeamId}
            className={`shrink-0 rounded-full border-2 border-[var(--color-ink)] px-4 py-1.5 text-sm font-bold transition disabled:opacity-30 ${
              tab === t.key
                ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {filteredMatches.map((m) => (
          <li key={m.id}>
            <Link
              href={`/matches/${m.id}`}
              className="card flex items-center gap-3 p-3 hover:translate-y-[-1px] transition-transform"
            >
              <Pill status={m.status} sport={m.sport} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">
                  {getName(m.ta)} <span className="opacity-50">vs</span> {getName(m.tb)}
                </p>
                {m.status === "confirmed" && (
                  <p className="text-xs text-[var(--color-ink)]/60">
                    Final: {m.score_a}–{m.score_b}
                  </p>
                )}
                {m.status === "pending" && (
                  <p className="text-xs text-[var(--color-ink)]/60">
                    Submitted: {m.score_a}–{m.score_b}
                  </p>
                )}
              </div>
              <span className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-2 py-1 text-[10px] font-black uppercase">
                Open
              </span>
            </Link>
          </li>
        ))}
        {filteredFlights.map((f) => (
          <li key={f.id}>
            <Link
              href={`/matches/flight/${f.id}`}
              className="card flex items-center gap-3 p-3 hover:translate-y-[-1px] transition-transform"
            >
              <Pill status={f.status} sport={f.sport} round={f.round_number} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">
                  {getName(f.t1)} <span className="opacity-50">vs</span> {getName(f.t2)}
                </p>
                {f.status === "confirmed" && (
                  <p className="text-xs text-[var(--color-ink)]/60">
                    Strokes: {f.strokes_1}–{f.strokes_2}
                  </p>
                )}
                {f.status === "pending" && (
                  <p className="text-xs text-[var(--color-ink)]/60">
                    Submitted: {f.strokes_1}–{f.strokes_2}
                  </p>
                )}
              </div>
              <span className="rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] px-2 py-1 text-[10px] font-black uppercase">
                Open
              </span>
            </Link>
          </li>
        ))}
        {filteredMatches.length === 0 && filteredFlights.length === 0 && (
          <li className="card p-6 text-center text-[var(--color-ink)]/60">
            Nothing here yet.
          </li>
        )}
      </ul>
    </div>
  );
}

function Pill({
  status,
  sport,
  round,
}: {
  status: SubmissionStatus | null;
  sport: Sport;
  round?: number;
}) {
  const styles =
    status === "pending"
      ? "bg-[var(--color-mustard)]"
      : status === "disputed"
        ? "bg-[var(--color-terracotta)] text-[var(--color-cream)]"
        : status === "confirmed"
          ? "bg-[var(--color-teal)] text-[var(--color-cream)]"
          : "bg-[var(--color-cream-50)]";
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-[var(--color-ink)] px-2 py-1 text-[10px] font-black uppercase ${styles}`}
      style={{ minWidth: 56 }}
    >
      <span className="text-base leading-none">{sportEmoji(sport)}</span>
      <span className="mt-0.5 leading-none">
        {sportLabel(sport).slice(0, 4)}
        {round ? ` R${round}` : ""}
      </span>
    </div>
  );
}
