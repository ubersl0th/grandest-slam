import Image from "next/image";
import Link from "next/link";
import { isAdminRole } from "@/lib/auth";
import type { Profile, Team } from "@/lib/database.types";

type Props = {
	user: { profile: Profile | null; team: Team | null } | null;
	children: React.ReactNode;
	active?: "leaderboard" | "matches" | "dashboard" | "admin" | "profile";
};

export function AppShell({ user, children, active }: Props) {
	const showAdmin = isAdminRole(user?.profile?.role);
	const showBottomNav = Boolean(user?.profile);
	return (
		<div className={`min-h-dvh md:pb-10 ${showBottomNav ? "pb-24" : "pb-10"}`}>
			<header className="sticky top-0 z-40 border-b-2 border-[var(--color-ink)] bg-[var(--color-cream)]/95 backdrop-blur">
				<div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
					<Link href="/" className="flex items-center gap-2">
						<Image
							src="/The_Grandest_Slam.webp"
							alt=""
							width={64}
							height={64}
							className="h-8 w-8 rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-mustard)] object-cover"
						/>
						<span
							className="font-black tracking-wider text-sm sm:text-base"
							style={{ fontFamily: "var(--font-display)" }}
						>
							THE GRANDEST SLAM
						</span>
					</Link>
					<nav className="hidden items-center gap-1 md:flex">
						<NavLink href="/leaderboard" active={active === "leaderboard"}>
							Resultatliste
						</NavLink>
						{user?.profile && (
							<NavLink href="/matches" active={active === "matches"}>
								Kamper
							</NavLink>
						)}
						{user?.profile && (
							<NavLink href="/dashboard" active={active === "dashboard"}>
								Mitt lag
							</NavLink>
						)}
						{user?.profile && (
							<NavLink href="/profile" active={active === "profile"}>
								Profil
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
									Logg ut
								</button>
							</form>
						) : (
							<Link
								href="/auth/sign-in"
								className="btn btn-secondary !py-2 !px-4 !text-sm"
							>
								Logg inn
							</Link>
						)}
					</div>
				</div>
			</header>

			<main>{children}</main>

			{showBottomNav && (
				<nav
					className={`fixed bottom-0 left-0 right-0 z-40 grid border-t-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] md:hidden ${
						showAdmin ? "grid-cols-5" : "grid-cols-4"
					}`}
				>
					<BottomNavLink
						href="/leaderboard"
						active={active === "leaderboard"}
						icon="🏆"
						label="Liste"
					/>
					<BottomNavLink
						href="/matches"
						active={active === "matches"}
						icon="🎾"
						label="Kamper"
					/>
					<BottomNavLink
						href="/dashboard"
						active={active === "dashboard"}
						icon="👥"
						label="Lag"
					/>
					<BottomNavLink
						href="/profile"
						active={active === "profile"}
						icon="🙂"
						label="Profil"
					/>
					{showAdmin && (
						<BottomNavLink
							href="/admin"
							active={active === "admin"}
							icon="⚙️"
							label="Admin"
						/>
					)}
				</nav>
			)}
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
