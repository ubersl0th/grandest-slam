"use client";

import { useState } from "react";
import type { ExperienceLevel, Sport } from "@/lib/database.types";
import { EXPERIENCE_LEVELS, SPORTS } from "@/lib/sports";

type ExperienceMap = Record<Sport, ExperienceLevel>;

type PlayerForm = {
	first_name: string;
	last_name: string;
	nickname: string;
	email: string;
	bio: string;
	experience: ExperienceMap;
};

type FormState = {
	team_name: string;
	team_bio: string;
	player_1: PlayerForm;
	player_2: PlayerForm;
};

const emptyExperience = (): ExperienceMap => ({
	padel: "intermediate",
	tennis: "intermediate",
	disc_golf: "intermediate",
	golf: "intermediate",
});

const emptyPlayer = (): PlayerForm => ({
	first_name: "",
	last_name: "",
	nickname: "",
	email: "",
	bio: "",
	experience: emptyExperience(),
});

const emptyForm = (): FormState => ({
	team_name: "",
	team_bio: "",
	player_1: emptyPlayer(),
	player_2: emptyPlayer(),
});

export function TeamJoinForm() {
	const [form, setForm] = useState<FormState>(emptyForm());
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	function updatePlayer(
		slot: "player_1" | "player_2",
		patch: Partial<PlayerForm>,
	) {
		setForm({ ...form, [slot]: { ...form[slot], ...patch } });
	}

	function updatePlayerExperience(
		slot: "player_1" | "player_2",
		sport: Sport,
		level: ExperienceLevel,
	) {
		updatePlayer(slot, {
			experience: { ...form[slot].experience, [sport]: level },
		});
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			const res = await fetch("/api/team-signup", {
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
					Lagpåmelding mottatt!
				</h2>
				<p className="mx-auto mt-3 max-w-sm text-[var(--color-ink)]/75">
					En administrator vil gjennomgå påmeldingen av{" "}
					<strong>{form.team_name}</strong>. Når den er godkjent får begge
					spillere en magisk lenke på e-post for å fullføre innloggingen.
				</p>
			</div>
		);
	}

	return (
		<form onSubmit={onSubmit} className="mt-8 space-y-6">
			<div className="card p-5 md:p-6">
				<h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
					Om laget
				</h2>
				<div className="mt-3 grid grid-cols-1 gap-3">
					<label className="block">
						<span className="label">Lagnavn</span>
						<input
							required
							maxLength={60}
							className="input"
							placeholder="The Sun Smashers"
							value={form.team_name}
							onChange={(e) => setForm({ ...form, team_name: e.target.value })}
						/>
					</label>
					<label className="block">
						<span className="label">Lagets historie (valgfritt)</span>
						<textarea
							rows={2}
							className="input"
							maxLength={500}
							placeholder="En kjapp historie, et stridsrop eller en advarsel…"
							value={form.team_bio}
							onChange={(e) => setForm({ ...form, team_bio: e.target.value })}
						/>
					</label>
				</div>
			</div>

			<PlayerCard
				index={1}
				player={form.player_1}
				onChange={(patch) => updatePlayer("player_1", patch)}
				onExperience={(sport, level) =>
					updatePlayerExperience("player_1", sport, level)
				}
			/>
			<PlayerCard
				index={2}
				player={form.player_2}
				onChange={(patch) => updatePlayer("player_2", patch)}
				onExperience={(sport, level) =>
					updatePlayerExperience("player_2", sport, level)
				}
			/>

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
				{submitting ? "Melder på laget…" : "Meld på laget →"}
			</button>
			<p className="text-center text-xs text-[var(--color-ink)]/60">
				En administrator gjennomgår påmeldingen før magiske lenker sendes til
				begge spillerne.
			</p>
		</form>
	);
}

function PlayerCard({
	index,
	player,
	onChange,
	onExperience,
}: {
	index: 1 | 2;
	player: PlayerForm;
	onChange: (patch: Partial<PlayerForm>) => void;
	onExperience: (sport: Sport, level: ExperienceLevel) => void;
}) {
	return (
		<div className="card p-5 md:p-6">
			<h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
				Spiller {index}
			</h2>
			<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
				<label className="block">
					<span className="label">Fornavn</span>
					<input
						required
						maxLength={40}
						className="input"
						value={player.first_name}
						onChange={(e) => onChange({ first_name: e.target.value })}
					/>
				</label>
				<label className="block">
					<span className="label">Etternavn</span>
					<input
						required
						maxLength={40}
						className="input"
						value={player.last_name}
						onChange={(e) => onChange({ last_name: e.target.value })}
					/>
				</label>
				<label className="block">
					<span className="label">E-post</span>
					<input
						required
						type="email"
						className="input"
						value={player.email}
						onChange={(e) => onChange({ email: e.target.value })}
					/>
				</label>
				<label className="block">
					<span className="label">Kallenavn (valgfritt)</span>
					<input
						className="input"
						maxLength={40}
						placeholder="Hva skal vi kalle deg?"
						value={player.nickname}
						onChange={(e) => onChange({ nickname: e.target.value })}
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
					value={player.bio}
					onChange={(e) => onChange({ bio: e.target.value })}
				/>
			</label>

			<div className="mt-4">
				<p className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
					Ferdighetsnivå
				</p>
				<div className="mt-3 space-y-3">
					{SPORTS.map((s) => (
						<ExperiencePicker
							key={s.key}
							sport={s}
							value={player.experience[s.key]}
							onChange={(level) => onExperience(s.key, level)}
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
