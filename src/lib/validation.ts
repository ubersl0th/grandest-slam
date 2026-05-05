import { z } from "zod";

const sport = z.enum(["padel", "tennis", "disc_golf", "golf"]);
const level = z.enum(["beginner", "intermediate", "advanced"]);

const experienceMap = z.object({
	padel: level,
	tennis: level,
	disc_golf: level,
	golf: level,
});

export const playerSubmissionSchema = z.object({
	first_name: z.string().trim().min(1, "Fornavn er påkrevd").max(40),
	last_name: z.string().trim().min(1, "Etternavn er påkrevd").max(40),
	nickname: z.string().trim().max(40).optional().or(z.literal("")),
	email: z
		.string()
		.email("Gyldig e-postadresse kreves")
		.transform((v) => v.toLowerCase().trim()),
	bio: z.string().trim().max(500).optional().or(z.literal("")),
	experience: experienceMap,
});

const playerSection = z.object({
	first_name: z.string().trim().min(1, "Fornavn er påkrevd").max(40),
	last_name: z.string().trim().min(1, "Etternavn er påkrevd").max(40),
	nickname: z.string().trim().max(40).optional().or(z.literal("")),
	email: z
		.string()
		.email("Gyldig e-postadresse kreves")
		.transform((v) => v.toLowerCase().trim()),
	bio: z.string().trim().max(500).optional().or(z.literal("")),
	experience: experienceMap,
});

export const teamSubmissionSchema = z
	.object({
		team_name: z.string().trim().min(2, "Lagnavn er påkrevd").max(60),
		team_bio: z.string().trim().max(500).optional().or(z.literal("")),
		player_1: playerSection,
		player_2: playerSection,
	})
	.refine((v) => v.player_1.email !== v.player_2.email, {
		message: "Spillerne må ha forskjellige e-postadresser.",
		path: ["player_2", "email"],
	});

export type PlayerSubmissionPayload = z.infer<typeof playerSubmissionSchema>;
export type TeamSubmissionPayload = z.infer<typeof teamSubmissionSchema>;
export const sportEnum = sport;
export const levelEnum = level;
