import { z } from "zod";

const sport = z.enum(["padel", "tennis", "disc_golf", "golf"]);
const level = z.enum(["beginner", "intermediate", "advanced"]);

export const playerSubmissionSchema = z.object({
	first_name: z.string().trim().min(1, "Fornavn er påkrevd").max(40),
	last_name: z.string().trim().min(1, "Etternavn er påkrevd").max(40),
	nickname: z.string().trim().max(40).optional().or(z.literal("")),
	email: z
		.string()
		.email("Gyldig e-postadresse kreves")
		.transform((v) => v.toLowerCase().trim()),
	bio: z.string().trim().max(500).optional().or(z.literal("")),
	experience: z.object({
		padel: level,
		tennis: level,
		disc_golf: level,
		golf: level,
	}),
});

export type PlayerSubmissionPayload = z.infer<typeof playerSubmissionSchema>;
export const sportEnum = sport;
export const levelEnum = level;
