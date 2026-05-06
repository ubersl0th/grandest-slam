"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AvatarUploader } from "@/components/avatar-uploader";
import type { ExperienceLevel, Sport } from "@/lib/database.types";
import { EXPERIENCE_LEVELS, SPORTS } from "@/lib/sports";
import { createClient } from "@/lib/supabase/client";

type Initial = {
	nickname: string;
	bio: string;
	avatarUrl: string | null;
	experience: Partial<Record<Sport, ExperienceLevel>>;
};

type Props = {
	profileId: string;
	displayName: string;
	initial: Initial;
	hasTeam: boolean;
};

const DEFAULT_LEVEL: ExperienceLevel = "intermediate";

export function ProfileForm({
	profileId,
	displayName,
	initial,
	hasTeam,
}: Props) {
	const router = useRouter();
	const supabase = createClient();
	const [nickname, setNickname] = useState(initial.nickname);
	const [bio, setBio] = useState(initial.bio);
	const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);
	const [avatarMsg, setAvatarMsg] = useState<string | null>(null);
	const [experience, setExperience] = useState<Record<Sport, ExperienceLevel>>(
		() => {
			const out = {} as Record<Sport, ExperienceLevel>;
			for (const s of SPORTS) {
				out[s.key] = initial.experience[s.key] ?? DEFAULT_LEVEL;
			}
			return out;
		},
	);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
		null,
	);

	const hadFullExperience = SPORTS.every((s) =>
		Boolean(initial.experience[s.key]),
	);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setBusy(true);
		setMsg(null);

		const { error: profileErr } = await supabase
			.from("profiles")
			.update({
				nickname: nickname.trim() || null,
				bio: bio.trim() || null,
			})
			.eq("id", profileId);

		if (profileErr) {
			setBusy(false);
			setMsg({ kind: "err", text: profileErr.message });
			return;
		}

		const rows = SPORTS.map((s) => ({
			profile_id: profileId,
			sport: s.key,
			level: experience[s.key],
		}));
		const { error: expErr } = await supabase
			.from("player_experience")
			.upsert(rows, { onConflict: "profile_id,sport" });

		setBusy(false);
		if (expErr) {
			setMsg({ kind: "err", text: expErr.message });
			return;
		}
		setMsg({ kind: "ok", text: "Profilen er lagret." });
		router.refresh();
	}

	return (
		<form onSubmit={onSubmit} className="mt-8 space-y-6">
			{!hasTeam && (
				<div className="card border-[var(--color-mustard)] bg-[var(--color-mustard)]/20 p-4 text-sm">
					<p className="font-bold">Du er ikke på et lag enda.</p>
					<p className="mt-1 text-[var(--color-ink)]/75">
						Fyll ut ferdighetene dine her — så plukker en administrator deg ut
						når lagene settes sammen.
					</p>
				</div>
			)}

			<div className="card p-5 md:p-6">
				<h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
					Om deg
				</h2>
				<div className="mt-3">
					<AvatarUploader
						pathPrefix={`profiles/${profileId}`}
						value={avatarUrl}
						name={displayName}
						kind="player"
						label="Profilbilde"
						helpText="Vises ved siden av navnet ditt overalt i appen."
						onChange={async (url) => {
							setAvatarMsg(null);
							const { error } = await supabase
								.from("profiles")
								.update({ avatar_url: url })
								.eq("id", profileId);
							if (error) {
								setAvatarMsg(error.message);
								return;
							}
							setAvatarUrl(url);
							router.refresh();
						}}
					/>
					{avatarMsg && (
						<p className="mt-2 text-xs font-bold text-[var(--color-terracotta-dark)]">
							{avatarMsg}
						</p>
					)}
				</div>
				<label className="mt-5 block">
					<span className="label">Kallenavn</span>
					<input
						className="input"
						maxLength={40}
						placeholder="Hva skal vi kalle deg?"
						value={nickname}
						onChange={(e) => setNickname(e.target.value)}
					/>
				</label>
				<label className="mt-3 block">
					<span className="label">Beskrivelse</span>
					<textarea
						rows={3}
						className="input"
						maxLength={500}
						placeholder="Et kjapt skryt, en påstand eller en advarsel…"
						value={bio}
						onChange={(e) => setBio(e.target.value)}
					/>
				</label>
			</div>

			<div className="card p-5 md:p-6">
				<h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
					Ferdighetsnivå per idrett
				</h2>
				<p className="mt-1 text-sm text-[var(--color-ink)]/70">
					{hadFullExperience
						? "Justér hvis nivået ditt har endret seg."
						: "Sett nivået ditt for hver idrett — vi bruker dette til å sette sammen balanserte lag."}
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
							value={experience[s.key]}
							onChange={(level) =>
								setExperience({ ...experience, [s.key]: level })
							}
						/>
					))}
				</div>
			</div>

			{msg && (
				<div
					className={`card p-3 text-sm font-bold ${
						msg.kind === "ok"
							? "border-[var(--color-teal)] bg-[var(--color-teal)]/10 text-[var(--color-teal-dark)]"
							: "border-[var(--color-terracotta)] bg-[var(--color-terracotta)]/10 text-[var(--color-terracotta-dark)]"
					}`}
				>
					{msg.text}
				</div>
			)}

			<button
				type="submit"
				disabled={busy}
				className="btn btn-primary w-full disabled:opacity-50"
			>
				{busy ? "Lagrer…" : "Lagre profil"}
			</button>
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
