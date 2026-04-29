import type { ExperienceLevel, Sport } from "@/lib/database.types";

export const SPORTS: { key: Sport; label: string; emoji: string }[] = [
  { key: "padel", label: "Padel", emoji: "🎾" },
  { key: "tennis", label: "Tennis", emoji: "🎾" },
  { key: "disc_golf", label: "Disc Golf", emoji: "🥏" },
  { key: "golf", label: "Golf", emoji: "⛳️" },
];

export const EXPERIENCE_LEVELS: { key: ExperienceLevel; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
  { key: "pro", label: "Pro" },
];

export const sportLabel = (s: Sport) =>
  SPORTS.find((sp) => sp.key === s)?.label ?? s;
export const sportEmoji = (s: Sport) =>
  SPORTS.find((sp) => sp.key === s)?.emoji ?? "";
