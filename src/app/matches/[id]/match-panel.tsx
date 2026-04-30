"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Sport, SubmissionStatus } from "@/lib/database.types";

type Props = {
  match: {
    id: string;
    sport: Sport;
    team_a: string;
    team_b: string;
    score_a: number | null;
    score_b: number | null;
    winner_team_id: string | null;
    status: SubmissionStatus | null;
    submitted_by: string | null;
    submitter_name: string | null;
    team_a_name: string;
    team_b_name: string;
  };
  viewer: {
    isParticipant: boolean;
    isAdmin: boolean;
    myTeamId: string | null;
    submittedByMyTeam: boolean;
  };
};

export function MatchPanel({ match, viewer }: Props) {
  const router = useRouter();
  const [scoreA, setScoreA] = useState<number | "">(match.score_a ?? "");
  const [scoreB, setScoreB] = useState<number | "">(match.score_b ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const canEdit = (viewer.isParticipant || viewer.isAdmin) && match.status !== "confirmed";
  const showConfirm =
    match.status === "pending" && (viewer.isAdmin || (viewer.isParticipant && !viewer.submittedByMyTeam));

  async function submit() {
    if (scoreA === "" || scoreB === "") {
      setError("Enter both scores.");
      return;
    }
    if (scoreA === scoreB) {
      setError("There must be a winner — no ties.");
      return;
    }
    setError(null);
    setBusy(true);
    const { error } = await supabase.rpc("submit_match_result", {
      p_match_id: match.id,
      p_score_a: scoreA,
      p_score_b: scoreB,
      p_notes: notes || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      router.refresh();
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("confirm_match_result", { p_match_id: match.id });
    setBusy(false);
    if (error) setError(error.message);
    else router.refresh();
  }

  async function dispute() {
    const reason = window.prompt("What's wrong with the submitted score?");
    if (reason === null) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("dispute_match_result", {
      p_match_id: match.id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) setError(error.message);
    else router.refresh();
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Status banner */}
      <StatusBanner match={match} viewer={viewer} />

      {/* Score input or display */}
      <div className="card p-5">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
          Score
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <ScoreSide
            teamName={match.team_a_name}
            value={scoreA}
            onChange={setScoreA}
            disabled={!canEdit}
            highlight={match.winner_team_id === match.team_a && match.status === "confirmed"}
          />
          <ScoreSide
            teamName={match.team_b_name}
            value={scoreB}
            onChange={setScoreB}
            disabled={!canEdit}
            highlight={match.winner_team_id === match.team_b && match.status === "confirmed"}
          />
        </div>
        {canEdit && (
          <label className="mt-4 block">
            <span className="label">Notes (optional)</span>
            <input
              className="input"
              placeholder="e.g. epic third set"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        )}
        {error && (
          <p className="mt-3 text-sm font-bold text-[var(--color-terracotta-dark)]">{error}</p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {canEdit && match.status !== "pending" && viewer.isParticipant && (
            <button onClick={submit} disabled={busy} className="btn btn-primary flex-1 disabled:opacity-50">
              {busy ? "Submitting…" : "Submit result"}
            </button>
          )}
          {canEdit && match.status === "pending" && viewer.submittedByMyTeam && (
            <button onClick={submit} disabled={busy} className="btn btn-secondary flex-1 disabled:opacity-50">
              {busy ? "Updating…" : "Update submitted score"}
            </button>
          )}
          {showConfirm && (
            <>
              <button
                onClick={confirm}
                disabled={busy}
                className="btn btn-tertiary flex-1 disabled:opacity-50"
              >
                {busy ? "Confirming…" : "Confirm score ✓"}
              </button>
              <button
                onClick={dispute}
                disabled={busy}
                className="btn btn-secondary flex-1 disabled:opacity-50"
              >
                Dispute
              </button>
            </>
          )}
          {match.status === "confirmed" && viewer.isAdmin && (
            <button
              onClick={async () => {
                if (!window.confirm("Reopen this match? The score will be reset to pending.")) return;
                setBusy(true);
                await supabase
                  .from("matches")
                  .update({ status: null, score_a: null, score_b: null, winner_team_id: null, submitted_by: null, submitted_at: null, confirmed_by: null, confirmed_at: null })
                  .eq("id", match.id);
                setBusy(false);
                router.refresh();
              }}
              className="btn btn-secondary flex-1"
            >
              Admin: reopen
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-[var(--color-ink)]/55">
        How it works: one team submits the score, the opposing team taps Confirm. If something
        looks off, tap Dispute to flag it for an admin.
      </p>
    </div>
  );
}

function StatusBanner({ match, viewer }: Props) {
  if (match.status === "confirmed") {
    return (
      <div className="card border-[var(--color-teal)] bg-[var(--color-teal)]/10 p-4">
        <p className="text-sm font-bold text-[var(--color-teal-dark)]">
          ✓ Final result confirmed
        </p>
      </div>
    );
  }
  if (match.status === "pending") {
    if (viewer.submittedByMyTeam) {
      return (
        <div className="card border-[var(--color-mustard)] bg-[var(--color-mustard)]/20 p-4">
          <p className="text-sm font-bold">
            ⏳ Waiting for the other team to confirm.
          </p>
        </div>
      );
    }
    if (viewer.isParticipant) {
      return (
        <div className="card border-[var(--color-mustard)] bg-[var(--color-mustard)]/20 p-4">
          <p className="text-sm font-bold">
            👋 {match.submitter_name ?? "The other team"} submitted a score. Confirm or dispute it below.
          </p>
        </div>
      );
    }
    return (
      <div className="card p-4">
        <p className="text-sm">Awaiting opponent confirmation.</p>
      </div>
    );
  }
  if (match.status === "disputed") {
    return (
      <div className="card border-[var(--color-terracotta)] bg-[var(--color-terracotta)]/10 p-4">
        <p className="text-sm font-bold text-[var(--color-terracotta-dark)]">
          ⚠️ This score is disputed. An admin needs to resolve it.
        </p>
      </div>
    );
  }
  if (viewer.isParticipant) {
    return (
      <div className="card p-4">
        <p className="text-sm">Match not played yet — submit your score when it&apos;s done.</p>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <p className="text-sm">This match hasn&apos;t been played yet.</p>
    </div>
  );
}

function ScoreSide({
  teamName,
  value,
  onChange,
  disabled,
  highlight,
}: {
  teamName: string;
  value: number | "";
  onChange: (v: number | "") => void;
  disabled: boolean;
  highlight: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-[var(--color-ink)] p-3 text-center ${
        highlight ? "bg-[var(--color-mustard)]" : "bg-[var(--color-cream-50)]"
      }`}
    >
      <p className="truncate text-sm font-bold">{teamName}</p>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Math.max(0, Number(e.target.value)))}
        className="mt-1 w-full bg-transparent text-center text-5xl font-black outline-none disabled:opacity-100"
        style={{ fontFamily: "var(--font-display)" }}
      />
      {!disabled && (
        <div className="mt-2 flex justify-center gap-1">
          <button
            type="button"
            onClick={() => onChange(typeof value === "number" ? Math.max(0, value - 1) : 0)}
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] text-lg font-black"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => onChange(typeof value === "number" ? value + 1 : 1)}
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] text-lg font-black"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
