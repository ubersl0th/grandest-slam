"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Profile, Team } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

type Props = {
	team: Team;
	currentUserId: string;
	teammate: Profile | null;
	requester: Profile | null;
};

export function TeamNameControls({
	team,
	currentUserId,
	teammate,
	requester,
}: Props) {
	const router = useRouter();
	const supabase = createClient();
	const [proposed, setProposed] = useState("");
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
		null,
	);

	const isPending = Boolean(team.pending_name);
	const iAmRequester = team.pending_name_requested_by === currentUserId;

	async function call<T>(
		runner: () => PromiseLike<{
			data: T | null;
			error: { message: string } | null;
		}>,
		ok: string,
	) {
		setBusy(true);
		setMsg(null);
		const { error } = await runner();
		setBusy(false);
		if (error) setMsg({ kind: "err", text: translate(error.message) });
		else {
			setMsg({ kind: "ok", text: ok });
			router.refresh();
		}
	}

	async function onPropose(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = proposed.trim();
		if (trimmed.length < 2) {
			setMsg({ kind: "err", text: "Navnet må være minst 2 tegn." });
			return;
		}
		await call(
			() =>
				supabase.rpc("request_team_name_change", {
					p_team_id: team.id,
					p_new_name: trimmed,
				}),
			teammate
				? `Forslaget ble sendt til ${teammate.nickname || teammate.full_name} for godkjenning.`
				: "Forslaget er lagret. Det trer i kraft når en lagkamerat godkjenner det.",
		);
		setProposed("");
	}

	async function onApprove() {
		await call(
			() => supabase.rpc("approve_team_name_change", { p_team_id: team.id }),
			"Lagnavnet er endret.",
		);
	}

	async function onCancel() {
		await call(
			() => supabase.rpc("cancel_team_name_change", { p_team_id: team.id }),
			"Forespørselen ble avbrutt.",
		);
	}

	return (
		<section className="card mt-6 p-5 md:p-6">
			<h2 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
				Lagnavn
			</h2>

			{!isPending && (
				<>
					<p className="mt-1 text-sm text-[var(--color-ink)]/70">
						{teammate
							? `Foreslå et nytt navn — det trer i kraft når ${teammate.nickname || teammate.full_name} godkjenner.`
							: "Foreslå et nytt navn. Det trer i kraft når en lagkamerat godkjenner forespørselen."}
					</p>
					<form
						onSubmit={onPropose}
						className="mt-3 flex flex-col gap-2 sm:flex-row"
					>
						<input
							className="input flex-1"
							maxLength={60}
							placeholder={team.name}
							value={proposed}
							onChange={(e) => setProposed(e.target.value)}
						/>
						<button
							type="submit"
							disabled={busy}
							className="btn btn-primary disabled:opacity-50"
						>
							Foreslå nytt navn
						</button>
					</form>
				</>
			)}

			{isPending && iAmRequester && (
				<div className="mt-3 rounded-xl border-2 border-dashed border-[var(--color-ink)] bg-[var(--color-cream-50)] p-3">
					<p className="text-sm">
						Du har foreslått <strong>«{team.pending_name}»</strong>. Venter på
						godkjenning fra{" "}
						{teammate ? (
							<strong>{teammate.nickname || teammate.full_name}</strong>
						) : (
							<em>en lagkamerat</em>
						)}
						.
					</p>
					<button
						type="button"
						onClick={onCancel}
						disabled={busy}
						className="btn btn-secondary mt-3 disabled:opacity-50"
					>
						Avbryt forespørselen
					</button>
				</div>
			)}

			{isPending && !iAmRequester && (
				<div className="mt-3 rounded-xl border-2 border-[var(--color-mustard)] bg-[var(--color-mustard)]/20 p-3">
					<p className="text-sm">
						{requester ? (
							<>
								<strong>{requester.nickname || requester.full_name}</strong> har
								foreslått at laget bytter navn fra{" "}
								<strong>«{team.name}»</strong> til{" "}
								<strong>«{team.pending_name}»</strong>.
							</>
						) : (
							<>
								En lagkamerat har foreslått{" "}
								<strong>«{team.pending_name}»</strong>.
							</>
						)}
					</p>
					<div className="mt-3 flex flex-col gap-2 sm:flex-row">
						<button
							type="button"
							onClick={onApprove}
							disabled={busy}
							className="btn btn-primary disabled:opacity-50"
						>
							Godkjenn navnet
						</button>
						<button
							type="button"
							onClick={onCancel}
							disabled={busy}
							className="btn btn-secondary disabled:opacity-50"
						>
							Avvis
						</button>
					</div>
				</div>
			)}

			{msg && (
				<p
					className={`mt-3 text-sm font-bold ${
						msg.kind === "ok"
							? "text-[var(--color-teal-dark)]"
							: "text-[var(--color-terracotta-dark)]"
					}`}
				>
					{msg.text}
				</p>
			)}
		</section>
	);
}

function translate(message: string): string {
	const map: Record<string, string> = {
		"name too short": "Navnet må være minst 2 tegn.",
		"name too long": "Navnet kan være maks 60 tegn.",
		"new name is the same as the current one":
			"Det nye navnet er likt det nåværende.",
		"a team already has that name": "Et annet lag har allerede det navnet.",
		"not a team member": "Du er ikke medlem av dette laget.",
		"requester cannot approve their own change":
			"Lagkameraten din må godkjenne det nye navnet.",
		"no pending name change": "Det er ingen ventende navneendring.",
		"team not found": "Laget finnes ikke.",
	};
	return map[message] ?? message;
}
