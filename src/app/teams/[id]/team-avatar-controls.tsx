"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { AvatarUploader } from "@/components/avatar-uploader";
import type { Profile, Team } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

type Props = {
	team: Team;
	currentUserId: string;
	teammate: Profile | null;
	requester: Profile | null;
};

export function TeamAvatarControls({
	team,
	currentUserId,
	teammate,
	requester,
}: Props) {
	const router = useRouter();
	const supabase = createClient();
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
		null,
	);

	const isPending = Boolean(team.pending_avatar_url);
	const iAmRequester = team.pending_avatar_requested_by === currentUserId;

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

	async function onProposeAvatar(url: string | null) {
		if (!url) return;
		await call(
			() =>
				supabase.rpc("request_team_avatar_change", {
					p_team_id: team.id,
					p_avatar_url: url,
				}),
			teammate
				? `Forslaget ble sendt til ${teammate.nickname || teammate.full_name} for godkjenning.`
				: "Forslaget er lagret. Det trer i kraft når en lagkamerat godkjenner det.",
		);
	}

	async function onApprove() {
		await call(
			() => supabase.rpc("approve_team_avatar_change", { p_team_id: team.id }),
			"Lagbildet er endret.",
		);
	}

	async function onCancel() {
		await call(
			() => supabase.rpc("cancel_team_avatar_change", { p_team_id: team.id }),
			"Forespørselen ble avbrutt.",
		);
	}

	return (
		<section className="card mt-6 p-5 md:p-6">
			<h2 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
				Lagbilde
			</h2>

			{!isPending && (
				<>
					<p className="mt-1 text-sm text-[var(--color-ink)]/70">
						{teammate
							? `Foreslå et nytt lagbilde — det trer i kraft når ${teammate.nickname || teammate.full_name} godkjenner.`
							: "Foreslå et nytt lagbilde. Det trer i kraft når en lagkamerat godkjenner forespørselen."}
					</p>
					<div className="mt-3">
						<AvatarUploader
							pathPrefix={`teams/${team.id}`}
							value={team.avatar_url}
							name={team.name}
							kind="team"
							label="Nåværende lagbilde"
							helpText={
								team.avatar_url
									? "Last opp et nytt bilde for å foreslå en endring."
									: "Last opp et lagbilde."
							}
							disabled={busy}
							onChange={onProposeAvatar}
						/>
					</div>
				</>
			)}

			{isPending && (
				<div
					className={`mt-3 rounded-xl border-2 p-3 ${
						iAmRequester
							? "border-dashed border-[var(--color-ink)] bg-[var(--color-cream-50)]"
							: "border-[var(--color-mustard)] bg-[var(--color-mustard)]/20"
					}`}
				>
					<div className="flex flex-wrap items-center gap-4">
						<div className="flex items-center gap-3">
							<div className="text-center">
								<p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
									Nå
								</p>
								<Avatar
									src={team.avatar_url}
									name={team.name}
									kind="team"
									size={64}
								/>
							</div>
							<span aria-hidden className="text-xl">
								→
							</span>
							<div className="text-center">
								<p className="mb-1 text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-ink)]/60">
									Forslag
								</p>
								<Avatar
									src={team.pending_avatar_url}
									name={team.name}
									kind="team"
									size={64}
								/>
							</div>
						</div>
						<p className="min-w-0 flex-1 text-sm">
							{iAmRequester ? (
								<>
									Du har foreslått et nytt lagbilde. Venter på godkjenning fra{" "}
									{teammate ? (
										<strong>{teammate.nickname || teammate.full_name}</strong>
									) : (
										<em>en lagkamerat</em>
									)}
									.
								</>
							) : requester ? (
								<>
									<strong>{requester.nickname || requester.full_name}</strong>{" "}
									har foreslått et nytt lagbilde.
								</>
							) : (
								<>En lagkamerat har foreslått et nytt lagbilde.</>
							)}
						</p>
					</div>

					<div className="mt-3 flex flex-col gap-2 sm:flex-row">
						{iAmRequester ? (
							<button
								type="button"
								onClick={onCancel}
								disabled={busy}
								className="btn btn-secondary disabled:opacity-50"
							>
								Avbryt forespørselen
							</button>
						) : (
							<>
								<button
									type="button"
									onClick={onApprove}
									disabled={busy}
									className="btn btn-primary disabled:opacity-50"
								>
									Godkjenn bildet
								</button>
								<button
									type="button"
									onClick={onCancel}
									disabled={busy}
									className="btn btn-secondary disabled:opacity-50"
								>
									Avvis
								</button>
							</>
						)}
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
		"avatar url required": "Last opp et bilde først.",
		"avatar url too long": "Bilde-URLen er for lang.",
		"not a team member": "Du er ikke medlem av dette laget.",
		"requester cannot approve their own change":
			"Lagkameraten din må godkjenne det nye bildet.",
		"no pending avatar change": "Det er ingen ventende bildeendring.",
		"team not found": "Laget finnes ikke.",
		"not authenticated": "Du må være innlogget.",
	};
	return map[message] ?? message;
}
