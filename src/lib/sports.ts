import type { ExperienceLevel, Sport } from "@/lib/database.types";

export const SPORTS: { key: Sport; label: string; emoji: string }[] = [
	{ key: "padel", label: "Padel", emoji: "🎾" },
	{ key: "tennis", label: "Tennis", emoji: "🎾" },
	{ key: "disc_golf", label: "Frisbeegolf", emoji: "🥏" },
	{ key: "golf", label: "Golf", emoji: "⛳️" },
];

export const EXPERIENCE_LEVELS: { key: ExperienceLevel; label: string }[] = [
	{ key: "beginner", label: "Nybegynner" },
	{ key: "intermediate", label: "Middels" },
	{ key: "advanced", label: "Avansert" },
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
