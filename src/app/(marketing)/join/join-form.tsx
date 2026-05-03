"use client";

import { useState } from "react";
import { EXPERIENCE_LEVELS, SPORTS } from "@/lib/sports";
import type { ExperienceLevel, Sport } from "@/lib/database.types";

type FormState = {
  first_name: string;
  last_name: string;
  nickname: string;
  email: string;
  bio: string;
  experience: Record<Sport, ExperienceLevel>;
};

const emptyForm = (): FormState => ({
  first_name: "",
  last_name: "",
  nickname: "",
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
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function update(patch: Partial<FormState>) {
    setForm({ ...form, ...patch });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
          An admin will review your sign-up. Once approved, <strong>{form.email}</strong>{" "}
          will get a magic link to finish signing in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <div className="card p-5 md:p-6">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
          About you
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">First name</span>
            <input
              required
              maxLength={40}
              className="input"
              value={form.first_name}
              onChange={(e) => update({ first_name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">Last name</span>
            <input
              required
              maxLength={40}
              className="input"
              value={form.last_name}
              onChange={(e) => update({ last_name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input
              required
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => update({ email: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">Nickname (optional)</span>
            <input
              className="input"
              maxLength={40}
              placeholder="What should we call you?"
              value={form.nickname}
              onChange={(e) => update({ nickname: e.target.value })}
            />
          </label>
        </div>

        <label className="mt-3 block">
          <span className="label">About you (optional)</span>
          <textarea
            rows={2}
            className="input"
            maxLength={500}
            placeholder="A quick brag, claim or warning…"
            value={form.bio}
            onChange={(e) => update({ bio: e.target.value })}
          />
        </label>
      </div>

      <div className="card p-5 md:p-6">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
          Skill level per sport
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink)]/70">
          Be honest — we use this to put together balanced teams.
        </p>
        <div className="mt-4 space-y-3">
          {SPORTS.map((s) => (
            <ExperiencePicker
              key={s.key}
              sport={s}
              value={form.experience[s.key]}
              onChange={(level) =>
                update({
                  experience: { ...form.experience, [s.key]: level },
                })
              }
            />
          ))}
        </div>
      </div>

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
        {submitting ? "Signing up…" : "Sign up →"}
      </button>
      <p className="text-center text-xs text-[var(--color-ink)]/60">
        By signing up you agree to play hard, lose graciously, and confirm your
        opponents&apos; scores honestly.
      </p>
    </form>
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
      <div className="grid grid-cols-3 gap-2">
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
