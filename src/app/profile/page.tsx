import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth";
import type { ExperienceLevel, Sport } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profil · The Grandest Slam" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
	const user = await getSessionUser();
	if (!user?.profile) redirect("/auth/sign-in?next=/profile");

	const supabase = await createClient();
	const { data: experience } = await supabase
		.from("player_experience")
		.select("sport, level")
		.eq("profile_id", user.id);

	const initialExperience: Partial<Record<Sport, ExperienceLevel>> = {};
	for (const e of (experience ?? []) as {
		sport: Sport;
		level: ExperienceLevel;
	}[]) {
		initialExperience[e.sport] = e.level;
	}

	return (
		<AppShell user={user} active="profile">
			<div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
				<p className="text-xs font-bold uppercase tracking-widest text-[var(--color-ink)]/60">
					Din profil
				</p>
				<h1
					className="mt-1 text-3xl md:text-5xl"
					style={{ fontFamily: "var(--font-display)" }}
				>
					{user.profile.full_name}
				</h1>
				<p className="mt-2 text-[var(--color-ink)]/75">
					Oppdater kallenavn, kort beskrivelse og ferdighetsnivåer. Lagene
					settes sammen ut fra ferdighetene dine.
				</p>

				<ProfileForm
					profileId={user.id}
					displayName={user.profile.full_name}
					initial={{
						nickname: user.profile.nickname ?? "",
						bio: user.profile.bio ?? "",
						avatarUrl: user.profile.avatar_url ?? null,
						experience: initialExperience,
					}}
					hasTeam={Boolean(user.team)}
				/>
			</div>
		</AppShell>
	);
}
