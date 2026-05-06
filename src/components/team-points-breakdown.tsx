import type { TeamTotals } from "@/lib/database.types";
import { SPORTS } from "@/lib/sports";

type Totals = Pick<
	TeamTotals,
	"padel_points" | "tennis_points" | "disc_golf_points" | "golf_points"
> | null;

function pointsFor(
	totals: Totals,
	key: (typeof SPORTS)[number]["key"],
): number {
	if (!totals) return 0;
	switch (key) {
		case "padel":
			return totals.padel_points ?? 0;
		case "tennis":
			return totals.tennis_points ?? 0;
		case "disc_golf":
			return totals.disc_golf_points ?? 0;
		case "golf":
			return totals.golf_points ?? 0;
	}
}

export function TeamPointsBreakdown({
	totals,
	className,
}: {
	totals: Totals;
	className?: string;
}) {
	return (
		<div className={`grid grid-cols-2 gap-2 sm:grid-cols-4 ${className ?? ""}`}>
			{SPORTS.map((s) => (
				<div
					key={s.key}
					className="flex items-center justify-between gap-2 rounded-xl border-2 border-ink bg-cream-50 px-3 py-2 sm:flex-col sm:items-stretch sm:justify-center sm:gap-1 sm:px-2 sm:text-center"
				>
					<div className="min-w-0 text-xs font-bold opacity-70">
						<span aria-hidden>{s.emoji}</span> <span>{s.label}</span>
					</div>
					<div
						className="text-2xl tabular-nums leading-none"
						style={{ fontFamily: "var(--font-display)" }}
					>
						{pointsFor(totals, s.key)}
					</div>
				</div>
			))}
		</div>
	);
}
