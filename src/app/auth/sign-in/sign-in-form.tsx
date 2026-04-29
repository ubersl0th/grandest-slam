"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignInForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? "/dashboard")}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className="card mt-6 p-6 text-center">
        <div
          className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-mustard)] text-2xl"
          aria-hidden
        >
          📬
        </div>
        <p className="mt-4 font-bold">Check your email</p>
        <p className="mt-1 text-sm text-[var(--color-ink)]/70">
          We sent a magic link to <strong>{email}</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="label">Email</span>
        <input
          required
          type="email"
          autoFocus
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>
      {error && (
        <p className="text-sm font-bold text-[var(--color-terracotta-dark)]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary w-full disabled:opacity-50"
      >
        {loading ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
