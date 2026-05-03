"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Sport, SubmissionStatus } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

type Props = {
	flight: {
		id: string;
		sport: Sport;
		round_number: number;
		team_1: string;
		team_2: string;
		strokes_1: number | null;
		strokes_2: number | null;
		status: SubmissionStatus | null;
		submitted_by: string | null;
		submitter_name: string | null;
		team_1_name: string;
		team_2_name: string;
	};
	viewer: {
		isParticipant: boolean;
		isAdmin: boolean;
		myTeamId: string | null;
		submittedByMyTeam: boolean;
	};
};

export function FlightPanel({ flight, viewer }: Props) {
	const router = useRouter();
	const [s1, setS1] = useState<number | "">(flight.strokes_1 ?? "");
	const [s2, setS2] = useState<number | "">(flight.strokes_2 ?? "");
	const [notes, setNotes] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const supabase = createClient();
	const canEdit =
		(viewer.isParticipant || viewer.isAdmin) && flight.status !== "confirmed";
	const showConfirm =
		flight.status === "pending" &&
		(viewer.isAdmin || (viewer.isParticipant && !viewer.submittedByMyTeam));

	async function submit() {
		if (s1 === "" || s2 === "") {
			setError("Skriv inn antall slag for begge lag.");
			return;
		}
		if (s1 <= 0 || s2 <= 0) {
			setError("Antall slag må være positivt.");
			return;
		}
		setError(null);
		setBusy(true);
		const { error } = await supabase.rpc("submit_flight_result", {
			p_flight_id: flight.id,
			p_strokes_1: s1,
			p_strokes_2: s2,
			p_notes: notes || null,
		});
		setBusy(false);
		if (error) setError(error.message);
		else router.refresh();
	}

	async function confirm() {
		setBusy(true);
		setError(null);
		const { error } = await supabase.rpc("confirm_flight_result", {
			p_flight_id: flight.id,
		});
		setBusy(false);
		if (error) setError(error.message);
		else router.refresh();
	}

	async function dispute() {
		const reason = window.prompt("Hva er galt med de innsendte slagene?");
		if (reason === null) return;
		setBusy(true);
		setError(null);
		const { error } = await supabase.rpc("dispute_flight_result", {
			p_flight_id: flight.id,
			p_reason: reason,
		});
		setBusy(false);
		if (error) setError(error.message);
		else router.refresh();
	}

	return (
		<div className="mt-6 space-y-4">
			<StatusBanner flight={flight} viewer={viewer} />

			<div className="card p-5">
				<h2 className="text-xs font-extrabold uppercase tracking-widest text-ink/60">
					Slag (lavest vinner)
				</h2>
				<div className="mt-3 grid grid-cols-2 gap-3">
					<Side
						teamName={flight.team_1_name}
						value={s1}
						onChange={setS1}
						disabled={!canEdit}
					/>
					<Side
						teamName={flight.team_2_name}
						value={s2}
						onChange={setS2}
						disabled={!canEdit}
					/>
				</div>
				{canEdit && (
					<label className="mt-4 block">
						<span className="label">Notater (valgfritt)</span>
						<input
							className="input"
							placeholder="f.eks. mistet ball på hull 7"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
						/>
					</label>
				)}
				{error && (
					<p className="mt-3 text-sm font-bold text-terracotta-dark">{error}</p>
				)}

				<div className="mt-4 flex flex-col gap-2 sm:flex-row">
					{canEdit && flight.status !== "pending" && viewer.isParticipant && (
						<button
							type="button"
							onClick={submit}
							disabled={busy}
							className="btn btn-primary flex-1 disabled:opacity-50"
						>
							{busy ? "Sender…" : "Send inn slag"}
						</button>
					)}
					{canEdit &&
						flight.status === "pending" &&
						viewer.submittedByMyTeam && (
							<button
								type="button"
								onClick={submit}
								disabled={busy}
								className="btn btn-secondary flex-1 disabled:opacity-50"
							>
								{busy ? "Oppdaterer…" : "Oppdater slag"}
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
								{busy ? "Bekrefter…" : "Bekreft slag ✓"}
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
					{flight.status === "confirmed" && viewer.isAdmin && (
						<button
							type="button"
							onClick={async () => {
								if (
									!window.confirm(
										"Gjenåpne denne runden? Slagene tilbakestilles.",
									)
								)
									return;
								setBusy(true);
								await supabase
									.from("flights")
									.update({
										status: null,
										strokes_1: null,
										strokes_2: null,
										submitted_by: null,
										submitted_at: null,
										confirmed_by: null,
										confirmed_at: null,
									})
									.eq("id", flight.id);
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
				Beste ball / beste disk: ta det laveste slaget mellom de to spillerne på
				hvert lag for hvert hull. Send inn lagets totalsum når runden er ferdig.
			</p>
		</div>
	);
}

function StatusBanner({ flight, viewer }: Props) {
	if (flight.status === "confirmed") {
		return (
			<div className="card border-teal bg-teal/10 p-4">
				<p className="text-sm font-bold text-teal-dark">
					✓ Endelige slag bekreftet
				</p>
			</div>
		);
	}
	if (flight.status === "pending") {
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
						👋 {flight.submitter_name ?? "Det andre laget"} sendte inn slag.
						Bekreft eller bestrid nedenfor.
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
	if (flight.status === "disputed") {
		return (
			<div className="card border-terracotta bg-terracotta/10 p-4">
				<p className="text-sm font-bold text-terracotta-dark">
					⚠️ Bestridt — administrator må løse dette.
				</p>
			</div>
		);
	}
	return (
		<div className="card p-4">
			<p className="text-sm">Runden er ikke spilt enda.</p>
		</div>
	);
}

function Side({
	teamName,
	value,
	onChange,
	disabled,
}: {
	teamName: string;
	value: number | "";
	onChange: (v: number | "") => void;
	disabled: boolean;
}) {
	return (
		<div className="rounded-2xl border-2 border-ink bg-cream-50 p-3 text-center">
			<p className="truncate text-sm font-bold">{teamName}</p>
			<input
				type="number"
				inputMode="numeric"
				min={1}
				max={300}
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
