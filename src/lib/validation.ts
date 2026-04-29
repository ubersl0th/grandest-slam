import { z } from "zod";

const sport = z.enum(["padel", "tennis", "disc_golf", "golf"]);
const level = z.enum(["beginner", "intermediate", "advanced", "pro"]);

const playerSchema = z.object({
  full_name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().email("Valid email required").transform((v) => v.toLowerCase().trim()),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  experience: z.object({
    padel: level,
    tennis: level,
    disc_golf: level,
    golf: level,
  }),
});

export const signupSchema = z
  .object({
    team_name: z.string().trim().min(2, "Team name is required").max(60),
    team_bio: z.string().trim().max(500).optional().or(z.literal("")),
    player_1: playerSchema,
    player_2: playerSchema,
  })
  .refine((d) => d.player_1.email !== d.player_2.email, {
    message: "Players must use different emails",
    path: ["player_2", "email"],
  });

export type SignupPayload = z.infer<typeof signupSchema>;
export const sportEnum = sport;
export const levelEnum = level;
