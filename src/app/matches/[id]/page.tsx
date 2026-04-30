import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sportEmoji, sportLabel } from "@/lib/sports";
import { MatchPanel } from "./match-panel";

export const revalidate = 0;

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/auth/sign-in?next=/matches/${id}`);

  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select("*, ta:team_a(id,name), tb:team_b(id,name), submitter:submitted_by(full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!match) notFound();

  const m = match as unknown as MatchRow;

  const myTeamId = user.team?.id ?? null;
  const onTeamA = myTeamId === m.team_a;
  const onTeamB = myTeamId === m.team_b;
  const isParticipant = onTeamA || onTeamB;
  const isAdmin = user.profile?.role === "admin" || user.profile?.role === "super_admin";

  return (
    <AppShell user={user} active="matches">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
        <Link href="/matches" className="text-sm font-bold opacity-70 hover:opacity-100">
          ← All matches
        </Link>

        <div className="mt-4">
          <p className="tag">
            {sportEmoji(m.sport)} {sportLabel(m.sport)}
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
            <Link href={`/teams/${m.team_a}`} className="hover:underline">{teamName(m.ta)}</Link>
            <span className="mx-2 opacity-50">vs</span>
            <Link href={`/teams/${m.team_b}`} className="hover:underline">{teamName(m.tb)}</Link>
          </h1>
        </div>

        <MatchPanel
          match={{
            id: m.id,
            sport: m.sport,
            team_a: m.team_a,
            team_b: m.team_b,
            score_a: m.score_a,
            score_b: m.score_b,
            winner_team_id: m.winner_team_id,
            status: m.status,
            submitted_by: m.submitted_by,
            submitter_name: m.submitter ? extractFullName(m.submitter) : null,
            team_a_name: teamName(m.ta),
            team_b_name: teamName(m.tb),
          }}
          viewer={{
            isParticipant,
            isAdmin,
            myTeamId,
            submittedByMyTeam: m.submitted_by_team !== null && m.submitted_by_team === myTeamId,
          }}
        />
      </div>
    </AppShell>
  );
}

type MatchRow = {
  id: string;
  sport: "padel" | "tennis";
  team_a: string;
  team_b: string;
  score_a: number | null;
  score_b: number | null;
  winner_team_id: string | null;
  status: "pending" | "confirmed" | "disputed" | null;
  submitted_by: string | null;
  submitted_by_team: string | null;
  ta: { id: string; name: string } | { id: string; name: string }[] | null;
  tb: { id: string; name: string } | { id: string; name: string }[] | null;
  submitter: { full_name: string } | { full_name: string }[] | null;
};

function teamName(rel: { id: string; name: string } | { id: string; name: string }[] | null) {
  if (!rel) return "?";
  return Array.isArray(rel) ? (rel[0]?.name ?? "?") : rel.name;
}
function extractFullName(rel: { full_name: string } | { full_name: string }[] | null) {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0]?.full_name ?? null) : rel.full_name;
}
