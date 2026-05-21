"use client";

import { useState } from "react";

export function SignInForm({ next }: { next?: string }) {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError(null);
		const res = await fetch("/api/auth/magic-link", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: email.trim().toLowerCase(), next }),
		});
		setLoading(false);
		if (!res.ok) {
			const data = (await res.json().catch(() => null)) as {
				message?: string;
			} | null;
			setError(data?.message ?? "Noe gikk galt. Prøv igjen om et øyeblikk.");
			return;
		}
		setSent(true);
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
				<p className="mt-4 font-bold">Sjekk e-posten din</p>
				<p className="mt-1 text-sm text-[var(--color-ink)]/70">
					Vi sendte en magisk lenke til <strong>{email}</strong>.
				</p>
			</div>
		);
	}

	return (
		<form onSubmit={onSubmit} className="mt-6 space-y-4">
			<label className="block">
				<span className="label">E-post</span>
				<input
					required
					type="email"
					className="input"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="du@eksempel.no"
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
				{loading ? "Sender…" : "Send magisk lenke"}
			</button>
		</form>
	);
}
