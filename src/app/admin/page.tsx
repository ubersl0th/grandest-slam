import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminConsole } from "./admin-console";

export const metadata: Metadata = { title: "Admin · The Grandest Slam" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
	const user = await getSessionUser();
	if (!user) redirect("/auth/sign-in?next=/admin");
	if (!isAdminRole(user.profile?.role)) redirect("/dashboard");

	const supabase = await createClient();

	const [
		{ data: tournament },
		{ data: teams },
		{ data: profiles },
		{ data: teamMembers },
		{ data: experience },
		{ data: matches },
		{ data: flights },
		{ data: submissions },
	] = await Promise.all([
		supabase.from("tournament").select("*").eq("id", 1).maybeSingle(),
		supabase.from("teams").select("*").order("name"),
		supabase.from("profiles").select("*").order("full_name"),
		supabase.from("team_members").select("team_id, profile_id"),
		supabase.from("player_experience").select("profile_id, sport, level"),
		supabase
			.from("matches")
			.select("*, ta:team_a(name), tb:team_b(name)")
			.order("created_at", { ascending: false })
			.limit(80),
		supabase
			.from("flights")
			.select("*, t1:team_1(name), t2:team_2(name)")
			.order("round_number")
			.order("created_at", { ascending: false }),
		supabase
			.from("player_submissions")
			.select("*")
			.order("created_at", { ascending: false }),
	]);

	return (
		<AppShell user={user} active="admin">
			<div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
				<h1
					className="text-3xl md:text-5xl"
					style={{ fontFamily: "var(--font-display)" }}
				>
					Admin
				</h1>
				<p className="mt-2 text-ink/75">
					Administrer turneringen, lagene og resultatene.
				</p>
				<AdminConsole
					isSuperAdmin={user.profile?.role === "super_admin"}
					tournament={tournament}
					teams={teams ?? []}
					profiles={profiles ?? []}
					teamMembers={teamMembers ?? []}
					experience={experience ?? []}
					matches={matches ?? []}
					flights={flights ?? []}
					submissions={submissions ?? []}
				/>
			</div>
		</AppShell>
	);
}
