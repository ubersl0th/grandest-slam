import type { ExperienceLevel, Sport } from "@/lib/database.types";

export const SPORTS: { key: Sport; label: string; emoji: string }[] = [
	{ key: "padel", label: "Padel", emoji: "🎾" },
	{ key: "tennis", label: "Tennis", emoji: "🎾" },
	{ key: "disc_golf", label: "Frisbeegolf", emoji: "🥏" },
	{ key: "golf", label: "Golf", emoji: "⛳️" },
];

export const EXPERIENCE_LEVELS: {
	key: ExperienceLevel;
	label: string;
	description: string;
}[] = [
	{
		key: "beginner",
		label: "Nybegynner",
		description:
			"Har spilt lite eller aldri før. Kan reglene, men teknikk og taktikk sitter ikke ennå.",
	},
	{
		key: "intermediate",
		label: "Middels",
		description:
			"Spiller jevnlig og har grunnleggende teknikk på plass. Holder følge i de fleste kamper.",
	},
	{
		key: "advanced",
		label: "Avansert",
		description:
			"Erfaren spiller med solid teknikk og taktikk. Trener eller spiller turneringer regelmessig.",
	},
];

// Numeric weights used by the team-balancer. Keep aligned with EXPERIENCE_LEVELS.
export const EXPERIENCE_WEIGHTS: Record<ExperienceLevel, number> = {
	beginner: 1,
	intermediate: 2,
	advanced: 3,
};

export const sportLabel = (s: Sport) =>
	SPORTS.find((sp) => sp.key === s)?.label ?? s;
export const sportEmoji = (s: Sport) =>
	SPORTS.find((sp) => sp.key === s)?.emoji ?? "";
export const experienceLabel = (l: ExperienceLevel | null | undefined) =>
	EXPERIENCE_LEVELS.find((e) => e.key === l)?.label ?? "—";
