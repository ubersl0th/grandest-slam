"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Sport, SubmissionStatus } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

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
	const canEdit =
		(viewer.isParticipant || viewer.isAdmin) && match.status !== "confirmed";
	const showConfirm =
		match.status === "pending" &&
		(viewer.isAdmin || (viewer.isParticipant && !viewer.submittedByMyTeam));

	async function submit() {
		if (scoreA === "" || scoreB === "") {
			setError("Skriv inn begge resultatene.");
			return;
		}
		if (scoreA === scoreB) {
			setError("Det må være en vinner — uavgjort er ikke tillatt.");
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
		const { error } = await supabase.rpc("confirm_match_result", {
			p_match_id: match.id,
		});
		setBusy(false);
		if (error) setError(error.message);
		else router.refresh();
	}

	async function dispute() {
		const reason = window.prompt("Hva er galt med det innsendte resultatet?");
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
				<h2 className="text-xs font-extrabold uppercase tracking-widest text-ink/60">
					Resultat
				</h2>
				<div className="mt-3 grid grid-cols-2 gap-3">
					<ScoreSide
						teamName={match.team_a_name}
						value={scoreA}
						onChange={setScoreA}
						disabled={!canEdit}
						highlight={
							match.winner_team_id === match.team_a &&
							match.status === "confirmed"
						}
					/>
					<ScoreSide
						teamName={match.team_b_name}
						value={scoreB}
						onChange={setScoreB}
						disabled={!canEdit}
						highlight={
							match.winner_team_id === match.team_b &&
							match.status === "confirmed"
						}
					/>
				</div>
				{canEdit && (
					<label className="mt-4 block">
						<span className="label">Notater (valgfritt)</span>
						<input
							className="input"
							placeholder="f.eks. episk tredje sett"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</label>
				)}
				{error && (
					<p className="mt-3 text-sm font-bold text-terracotta-dark">{error}</p>
				)}

				<div className="mt-4 flex flex-col gap-2 sm:flex-row">
					{canEdit && match.status !== "pending" && viewer.isParticipant && (
						<button
							type="button"
							onClick={submit}
							disabled={busy}
							className="btn btn-primary flex-1 disabled:opacity-50"
						>
							{busy ? "Sender…" : "Send inn resultat"}
						</button>
					)}
					{canEdit &&
						match.status === "pending" &&
						viewer.submittedByMyTeam && (
							<button
								type="button"
								onClick={submit}
								disabled={busy}
								className="btn btn-secondary flex-1 disabled:opacity-50"
							>
								{busy ? "Oppdaterer…" : "Oppdater innsendt resultat"}
							</button>
						)}
					{showConfirm && (
						<>
							<button
								type="button"
								onClick={confirm}
								disabled={busy}
								className="btn btn-tertiary flex-1 disabled:opacity-50"
							>
								{busy ? "Bekrefter…" : "Bekreft resultat ✓"}
							</button>
							<button
								type="button"
								onClick={dispute}
								disabled={busy}
								className="btn btn-secondary flex-1 disabled:opacity-50"
							>
								Bestrid
							</button>
						</>
					)}
					{match.status === "confirmed" && viewer.isAdmin && (
						<button
							type="button"
							onClick={async () => {
								if (
									!window.confirm(
										"Gjenåpne denne kampen? Resultatet tilbakestilles til avventende.",
									)
								)
									return;
								setBusy(true);
								await supabase
									.from("matches")
									.update({
										status: null,
										score_a: null,
										score_b: null,
										winner_team_id: null,
										submitted_by: null,
										submitted_at: null,
										confirmed_by: null,
										confirmed_at: null,
									})
									.eq("id", match.id);
								setBusy(false);
								router.refresh();
							}}
							className="btn btn-secondary flex-1"
						>
							Admin: gjenåpne
						</button>
					)}
				</div>
			</div>

			<p className="text-center text-xs text-ink/55">
				Slik fungerer det: ett lag sender inn resultatet, og motstanderlaget
				trykker Bekreft. Hvis noe ser feil ut, trykk Bestrid for å varsle en
				administrator.
			</p>
		</div>
	);
}

function StatusBanner({ match, viewer }: Props) {
	if (match.status === "confirmed") {
		return (
			<div className="card border-teal bg-teal/10 p-4">
				<p className="text-sm font-bold text-teal-dark">
					✓ Endelig resultat bekreftet
				</p>
			</div>
		);
	}
	if (match.status === "pending") {
		if (viewer.submittedByMyTeam) {
			return (
				<div className="card border-mustard bg-mustard/20 p-4">
					<p className="text-sm font-bold">
						⏳ Venter på at det andre laget bekrefter.
					</p>
				</div>
			);
		}
		if (viewer.isParticipant) {
			return (
				<div className="card border-mustard bg-mustard/20 p-4">
					<p className="text-sm font-bold">
						👋 {match.submitter_name ?? "Det andre laget"} sendte inn et
						resultat. Bekreft eller bestrid det nedenfor.
					</p>
				</div>
			);
		}
		return (
			<div className="card p-4">
				<p className="text-sm">Venter på bekreftelse fra motstanderen.</p>
			</div>
		);
	}
	if (match.status === "disputed") {
		return (
			<div className="card border-terracotta bg-terracotta/10 p-4">
				<p className="text-sm font-bold text-terracotta-dark">
					⚠️ Dette resultatet er bestridt. En administrator må løse det.
				</p>
			</div>
		);
	}
	if (viewer.isParticipant) {
		return (
			<div className="card p-4">
				<p className="text-sm">
					Kampen er ikke spilt enda — send inn resultatet når den er ferdig.
				</p>
			</div>
		);
	}
	return (
		<div className="card p-4">
			<p className="text-sm">Denne kampen er ikke spilt enda.</p>
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
			className={`rounded-2xl border-2 border-ink p-3 text-center ${
				highlight ? "bg-mustard" : "bg-cream-50"
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
				onChange={(e) =>
					onChange(
						e.target.value === "" ? "" : Math.max(0, Number(e.target.value)),
					)
				}
				className="mt-1 w-full bg-transparent text-center text-5xl font-black outline-none disabled:opacity-100"
				style={{ fontFamily: "var(--font-display)" }}
			/>
			{!disabled && (
				<div className="mt-2 flex justify-center gap-1">
					<button
						type="button"
						onClick={() =>
							onChange(typeof value === "number" ? Math.max(0, value - 1) : 0)
						}
						className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-cream-50 text-lg font-black"
					>
						−
					</button>
					<button
						type="button"
						onClick={() => onChange(typeof value === "number" ? value + 1 : 1)}
						className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink bg-cream-50 text-lg font-black"
					>
						+
					</button>
				</div>
			)}
		</div>
	);
}
