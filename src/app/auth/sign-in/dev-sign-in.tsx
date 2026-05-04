"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Profile } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

const DEV_PASSWORD = "password";

type Props = {
	profiles: Profile[];
	next?: string;
};

export function DevSignIn({ profiles, next }: Props) {
	const router = useRouter();
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function signInAs(profile: Profile) {
		setBusy(profile.id);
		setError(null);
		const supabase = createClient();
		const { error } = await supabase.auth.signInWithPassword({
			email: profile.email,
			password: DEV_PASSWORD,
		});
		setBusy(null);
		if (error) {
			setError(`${profile.email}: ${error.message}`);
			return;
		}
		router.push(next ?? "/dashboard");
		router.refresh();
	}

	return (
		<div className="card mt-6 border-dashed border-mustard p-4">
			<div className="flex items-center gap-2">
				<span className="rounded-full border-2 border-ink bg-mustard px-2 py-0.5 text-[10px] font-black uppercase">
					Dev
				</span>
				<p className="text-sm font-extrabold">Hurtiginnlogging</p>
			</div>
			<p className="mt-1 text-xs text-ink/70">
				Bare synlig i utviklingsmodus. Logg inn som en seedet bruker uten å gå
				via Inbucket.
			</p>
			<div className="mt-3 flex flex-col gap-1.5">
				{profiles.map((p) => (
					<button
						key={p.id}
						type="button"
						disabled={busy !== null}
						onClick={() => signInAs(p)}
						className="flex items-center justify-between gap-2 rounded-lg border-2 border-ink bg-cream-50 px-3 py-2 text-left text-sm font-bold disabled:opacity-50"
					>
						<span className="min-w-0 flex-1 truncate">
							{p.nickname ? `${p.full_name} (${p.nickname})` : p.full_name}
							<span className="ml-2 text-[11px] font-normal text-ink/60">
								{p.email}
							</span>
						</span>
						<RoleBadge role={p.role} />
						{busy === p.id && (
							<span className="text-[11px] font-normal opacity-70">
								Logger inn…
							</span>
						)}
					</button>
				))}
				{profiles.length === 0 && (
					<p className="text-xs italic text-ink/60">
						Ingen profiler i databasen. Kjør{" "}
						<code className="font-mono">supabase db reset</code> for å seede.
					</p>
				)}
			</div>
			{error && (
				<p className="mt-2 text-sm font-bold text-terracotta-dark">{error}</p>
			)}
		</div>
	);
}

function RoleBadge({ role }: { role: Profile["role"] }) {
	const styles =
		role === "super_admin"
			? "bg-plum text-cream"
			: role === "admin"
				? "bg-mustard"
				: "bg-cream";
	const label =
		role === "super_admin"
			? "Superadmin"
			: role === "admin"
				? "Admin"
				: "Spiller";
	return (
		<span
			className={`shrink-0 rounded-full border-2 border-ink px-2 py-0.5 text-[9px] font-black uppercase ${styles}`}
		>
			{label}
		</span>
	);
}
