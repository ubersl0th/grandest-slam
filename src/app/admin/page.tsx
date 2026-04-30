import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser, isAdminRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminConsole } from "./admin-console";

export const metadata = { title: "Admin · The Grandest Slam" };
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
    { data: matches },
    { data: flights },
  ] = await Promise.all([
    supabase.from("tournament").select("*").eq("id", 1).maybeSingle(),
    supabase.from("teams").select("*").order("name"),
    supabase.from("profiles").select("*").order("full_name"),
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
  ]);

  return (
    <AppShell user={user} active="admin">
      <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
        <h1 className="text-3xl md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
          Admin
        </h1>
        <p className="mt-2 text-[var(--color-ink)]/75">
          Manage the tournament, teams and results.
        </p>
        <AdminConsole
          isSuperAdmin={user.profile?.role === "super_admin"}
          tournament={tournament}
          teams={teams ?? []}
          profiles={profiles ?? []}
          matches={matches ?? []}
          flights={flights ?? []}
        />
      </div>
    </AppShell>
  );
}
