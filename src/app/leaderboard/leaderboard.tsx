"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeamTotals, Sport } from "@/lib/database.types";
import { SPORTS, sportEmoji, sportLabel } from "@/lib/sports";

type Tab = "overall" | Sport;

export function Leaderboard({ initial }: { initial: TeamTotals[] }) {
  const [rows, setRows] = useState<TeamTotals[]>(initial);
  const [tab, setTab] = useState<Tab>("overall");
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    async function refresh() {
      const { data } = await supabase
        .from("team_totals")
        .select("*")
        .order("total_points", { ascending: false });
      if (data) {
        setRows(data);
        setPulse(true);
        setTimeout(() => setPulse(false), 600);
      }
    }
    const channel = supabase
      .channel("leaderboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "flights" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    { key: "overall", label: "Overall", emoji: "🏆" },
    ...SPORTS.map((s) => ({ key: s.key as Tab, label: s.label, emoji: s.emoji })),
  ];

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border-2 border-[var(--color-ink)] px-4 py-1.5 text-sm font-bold transition shrink-0 ${
              tab === t.key
                ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                : "bg-[var(--color-cream-50)] hover:bg-[var(--color-cream-200)]"
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
        className={`mt-4 transition-shadow ${pulse ? "ring-4 ring-[var(--color-mustard)] rounded-2xl" : ""}`}
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
                  className="card flex items-center gap-3 p-3 md:p-4 hover:translate-y-[-1px] transition-transform"
                >
                  <Rank pos={i + 1} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-extrabold">{row.team_name}</p>
                    {tab === "overall" && (
                      <p className="text-xs text-[var(--color-ink)]/60">
                        Padel {row.padel_points} · Tennis {row.tennis_points} · Disc {row.disc_golf_points} · Golf {row.golf_points}
                      </p>
                    )}
                    {tab !== "overall" && (
                      <p className="text-xs text-[var(--color-ink)]/60">
                        {sportEmoji(tab)} {sportLabel(tab)}
                      </p>
                    )}
                  </div>
                  <div
                    className="grid h-12 min-w-12 place-items-center rounded-xl border-2 border-[var(--color-ink)] bg-[var(--color-mustard)] px-3 text-xl font-black"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {points}
                  </div>
                </Link>
              </li>
            );
          })}
          {sorted.length === 0 && (
            <li className="card p-8 text-center text-[var(--color-ink)]/60">
              No teams yet.
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
      ? "bg-[var(--color-mustard)]"
      : pos === 2
        ? "bg-[var(--color-cream-200)]"
        : pos === 3
          ? "bg-[var(--color-terracotta)] text-[var(--color-cream)]"
          : "bg-[var(--color-cream-50)]";
  return (
    <div
      className={`grid h-10 w-10 place-items-center rounded-full border-2 border-[var(--color-ink)] text-base font-black ${styles}`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {pos}
    </div>
  );
}
