"use client";

import { useState } from "react";
import { EXPERIENCE_LEVELS, SPORTS } from "@/lib/sports";
import type { ExperienceLevel, Sport } from "@/lib/database.types";

type PlayerState = {
  full_name: string;
  email: string;
  bio: string;
  experience: Record<Sport, ExperienceLevel>;
};

const emptyPlayer = (): PlayerState => ({
  full_name: "",
  email: "",
  bio: "",
  experience: {
    padel: "intermediate",
    tennis: "intermediate",
    disc_golf: "intermediate",
    golf: "intermediate",
  },
});

export function JoinForm() {
  const [teamName, setTeamName] = useState("");
  const [teamBio, setTeamBio] = useState("");
  const [p1, setP1] = useState<PlayerState>(emptyPlayer());
  const [p2, setP2] = useState<PlayerState>(emptyPlayer());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_name: teamName,
          team_bio: teamBio,
          player_1: p1,
          player_2: p2,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? "Something went wrong.");
      } else {
        setDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="card mt-8 p-8 text-center">
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-mustard)] text-3xl"
          aria-hidden
        >
          📨
        </div>
        <h2
          className="mt-4 text-2xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Submission received!
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[var(--color-ink)]/75">
          An admin will review your team. Once approved, both{" "}
          <strong>{p1.email}</strong> and <strong>{p2.email}</strong> will get a
          magic link to finish signing in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <div className="card p-5 md:p-6">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
          Team
        </h2>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="label">Team name</span>
            <input
              required
              minLength={2}
              maxLength={60}
              className="input"
              placeholder="The Sunburn Surfers"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Team bio (optional)</span>
            <textarea
              maxLength={500}
              rows={2}
              className="input"
              placeholder="What's the vibe?"
              value={teamBio}
              onChange={(e) => setTeamBio(e.target.value)}
            />
          </label>
        </div>
      </div>

      <PlayerCard n={1} player={p1} setPlayer={setP1} />
      <PlayerCard n={2} player={p2} setPlayer={setP2} />

      {error && (
        <div className="card border-[var(--color-terracotta)] bg-[var(--color-terracotta)]/10 p-4">
          <p className="text-sm font-bold text-[var(--color-terracotta-dark)]">
            {error}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary w-full disabled:opacity-50"
      >
        {submitting ? "Signing up…" : "Sign up team →"}
      </button>
      <p className="text-center text-xs text-[var(--color-ink)]/60">
        By signing up you agree to play hard, lose graciously, and confirm your
        opponents&apos; scores honestly.
      </p>
    </form>
  );
}

function PlayerCard({
  n,
  player,
  setPlayer,
}: {
  n: 1 | 2;
  player: PlayerState;
  setPlayer: (p: PlayerState) => void;
}) {
  const update = (patch: Partial<PlayerState>) =>
    setPlayer({ ...player, ...patch });

  return (
    <div className="card p-5 md:p-6">
      <h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
        Player {n}
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Full name</span>
          <input
            required
            className="input"
            value={player.full_name}
            onChange={(e) => update({ full_name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input
            required
            type="email"
            className="input"
            value={player.email}
            onChange={(e) => update({ email: e.target.value })}
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="label">Bio (optional)</span>
        <textarea
          rows={2}
          className="input"
          maxLength={500}
          placeholder="A quick brag, claim or warning…"
          value={player.bio}
          onChange={(e) => update({ bio: e.target.value })}
        />
      </label>

      <div className="mt-5">
        <p className="label">Experience level per sport</p>
        <div className="space-y-3">
          {SPORTS.map((s) => (
            <ExperiencePicker
              key={s.key}
              sport={s}
              value={player.experience[s.key]}
              onChange={(level) =>
                update({
                  experience: { ...player.experience, [s.key]: level },
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ExperiencePicker({
  sport,
  value,
  onChange,
}: {
  sport: { key: Sport; label: string; emoji: string };
  value: ExperienceLevel;
  onChange: (l: ExperienceLevel) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-bold">
        <span>{sport.emoji}</span>
        <span>{sport.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {EXPERIENCE_LEVELS.map((l) => {
          const selected = l.key === value;
          return (
            <button
              key={l.key}
              type="button"
              onClick={() => onChange(l.key)}
              className={`rounded-full border-2 border-[var(--color-ink)] py-2 text-xs font-bold transition ${
                selected
                  ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                  : "bg-[var(--color-cream-50)] text-[var(--color-ink)] hover:bg-[var(--color-cream-200)]"
              }`}
            >
              {l.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
