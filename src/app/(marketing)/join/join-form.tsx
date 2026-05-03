"use client";

import { useState } from "react";
import type { ExperienceLevel, Sport } from "@/lib/database.types";
import { EXPERIENCE_LEVELS, SPORTS } from "@/lib/sports";

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
				setError(json.message ?? "Noe gikk galt.");
			} else {
				setDone(true);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Nettverksfeil.");
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
					Påmelding mottatt!
				</h2>
				<p className="mx-auto mt-3 max-w-sm text-[var(--color-ink)]/75">
					En administrator vil gjennomgå påmeldingen din. Når den er godkjent,{" "}
					får <strong>{form.email}</strong> en magisk lenke for å fullføre
					innloggingen.
				</p>
			</div>
		);
	}

	return (
		<form onSubmit={onSubmit} className="mt-8 space-y-6">
			<div className="card p-5 md:p-6">
				<h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
					Om deg
				</h2>
				<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
					<label className="block">
						<span className="label">Fornavn</span>
						<input
							required
							maxLength={40}
							className="input"
							value={form.first_name}
							onChange={(e) => update({ first_name: e.target.value })}
						/>
					</label>
					<label className="block">
						<span className="label">Etternavn</span>
						<input
							required
							maxLength={40}
							className="input"
							value={form.last_name}
							onChange={(e) => update({ last_name: e.target.value })}
						/>
					</label>
					<label className="block">
						<span className="label">E-post</span>
						<input
							required
							type="email"
							className="input"
							value={form.email}
							onChange={(e) => update({ email: e.target.value })}
						/>
					</label>
					<label className="block">
						<span className="label">Kallenavn (valgfritt)</span>
						<input
							className="input"
							maxLength={40}
							placeholder="Hva skal vi kalle deg?"
							value={form.nickname}
							onChange={(e) => update({ nickname: e.target.value })}
						/>
					</label>
				</div>

				<label className="mt-3 block">
					<span className="label">Om deg (valgfritt)</span>
					<textarea
						rows={2}
						className="input"
						maxLength={500}
						placeholder="Et kjapt skryt, en påstand eller advarsel…"
						value={form.bio}
						onChange={(e) => update({ bio: e.target.value })}
					/>
				</label>
			</div>

			<div className="card p-5 md:p-6">
				<h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
					Ferdighetsnivå per idrett
				</h2>
				<p className="mt-1 text-sm text-[var(--color-ink)]/70">
					Vær ærlig — vi bruker dette til å sette sammen balanserte lag.
				</p>
				<dl className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border-2 border-dashed border-[var(--color-ink)]/30 p-3 sm:grid-cols-3">
					{EXPERIENCE_LEVELS.map((l) => (
						<div key={l.key}>
							<dt className="text-xs font-extrabold uppercase tracking-wide text-[var(--color-ink)]">
								{l.label}
							</dt>
							<dd className="mt-1 text-xs leading-snug text-[var(--color-ink)]/75">
								{l.description}
							</dd>
						</div>
					))}
				</dl>
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
				{submitting ? "Melder på…" : "Meld på →"}
			</button>
			<p className="text-center text-xs text-[var(--color-ink)]/60">
				Ved å melde deg på samtykker du i å spille hardt, tape verdig og
				bekrefte motstandernes poeng ærlig.
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
