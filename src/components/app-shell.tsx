import Link from "next/link";
import { isAdminRole } from "@/lib/auth";
import type { Profile, Team } from "@/lib/database.types";

type Props = {
  user: { profile: Profile | null; team: Team | null } | null;
  children: React.ReactNode;
  active?: "leaderboard" | "matches" | "dashboard" | "admin";
};

export function AppShell({ user, children, active }: Props) {
  const showAdmin = isAdminRole(user?.profile?.role);
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-40 border-b-2 border-[var(--color-ink)] bg-[var(--color-cream)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-mustard)]" />
            <span
              className="font-black tracking-wider text-sm sm:text-base"
              style={{ fontFamily: "var(--font-display)" }}
            >
              GRANDEST SLAM
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink href="/leaderboard" active={active === "leaderboard"}>
              Leaderboard
            </NavLink>
            {user?.profile && (
              <NavLink href="/matches" active={active === "matches"}>
                Matches
              </NavLink>
            )}
            {user?.profile && (
              <NavLink href="/dashboard" active={active === "dashboard"}>
                My team
              </NavLink>
            )}
            {showAdmin && (
              <NavLink href="/admin" active={active === "admin"}>
                Admin
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-2">
            {user?.profile ? (
              <form action="/auth/sign-out" method="post">
                <button
                  type="submit"
                  className="rounded-full px-3 py-1.5 text-xs font-bold opacity-70 hover:opacity-100"
                >
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/auth/sign-in" className="btn btn-secondary !py-2 !px-4 !text-sm">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] md:hidden">
        <BottomNavLink href="/leaderboard" active={active === "leaderboard"} icon="🏆" label="Board" />
        <BottomNavLink href="/matches" active={active === "matches"} icon="🎾" label="Matches" />
        <BottomNavLink href="/dashboard" active={active === "dashboard"} icon="👥" label="Team" />
        {showAdmin ? (
          <BottomNavLink href="/admin" active={active === "admin"} icon="⚙️" label="Admin" />
        ) : (
          <BottomNavLink href="/" active={false} icon="🏠" label="Home" />
        )}
      </nav>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-2 text-sm font-bold transition ${
        active
          ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
          : "hover:bg-[var(--color-cream-200)]"
      }`}
    >
      {children}
    </Link>
  );
}

function BottomNavLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-0.5 py-2 text-xs font-bold ${
        active ? "text-[var(--color-terracotta)]" : "text-[var(--color-ink)]/70"
      }`}
    >
      <span className="text-lg" aria-hidden>
        {icon}
      </span>
      {label}
    </Link>
  );
}
