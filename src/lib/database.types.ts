// Auto-generated types — run `pnpm gen:types` after starting Supabase locally.
// This is a hand-written stub used until the local Supabase stack is running.

export type Sport = "padel" | "tennis" | "disc_golf" | "golf";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type UserRole = "player" | "admin" | "super_admin";
export type SubmissionStatus = "pending" | "confirmed" | "disputed";
export type TournamentStatus = "not_started" | "active" | "completed";
export type PlayerReviewStatus = "pending" | "approved" | "rejected";
export type TeamReviewStatus = "pending" | "approved" | "rejected";

export type TeamSubmission = {
	id: string;
	status: TeamReviewStatus;
	team_name: string;
	team_bio: string | null;
	team_avatar_url: string | null;
	player_1_first_name: string;
	player_1_last_name: string;
	player_1_nickname: string | null;
	player_1_email: string;
	player_1_bio: string | null;
	player_1_avatar_url: string | null;
	player_1_experience: Record<Sport, ExperienceLevel>;
	player_2_first_name: string;
	player_2_last_name: string;
	player_2_nickname: string | null;
	player_2_email: string;
	player_2_bio: string | null;
	player_2_avatar_url: string | null;
	player_2_experience: Record<Sport, ExperienceLevel>;
	rejection_reason: string | null;
	reviewed_by: string | null;
	reviewed_at: string | null;
	approved_team_id: string | null;
	created_at: string;
};

export type PlayerSubmission = {
	id: string;
	status: PlayerReviewStatus;
	first_name: string;
	last_name: string;
	nickname: string | null;
	email: string;
	bio: string | null;
	avatar_url: string | null;
	experience: Record<Sport, ExperienceLevel>;
	rejection_reason: string | null;
	reviewed_by: string | null;
	reviewed_at: string | null;
	approved_profile_id: string | null;
	created_at: string;
};

export type Profile = {
	id: string;
	email: string;
	first_name: string;
	last_name: string | null;
	full_name: string;
	nickname: string | null;
	bio: string | null;
	avatar_url: string | null;
	role: UserRole;
	created_at: string;
};

export type Team = {
	id: string;
	name: string;
	bio: string | null;
	avatar_url: string | null;
	pending_name: string | null;
	pending_name_requested_by: string | null;
	pending_name_requested_at: string | null;
	pending_avatar_url: string | null;
	pending_avatar_requested_by: string | null;
	pending_avatar_requested_at: string | null;
	created_at: string;
};

export type TeamMember = {
	team_id: string;
	profile_id: string;
};

export type PlayerExperience = {
	profile_id: string;
	sport: Sport;
	level: ExperienceLevel;
};

export type Match = {
	id: string;
	sport: Sport;
	team_a: string;
	team_b: string;
	winner_team_id: string | null;
	score_a: number | null;
	score_b: number | null;
	notes: string | null;
	submitted_by: string | null;
	submitted_by_team: string | null;
	submitted_at: string | null;
	confirmed_by: string | null;
	confirmed_at: string | null;
	status: SubmissionStatus | null;
	created_at: string;
};

export type Flight = {
	id: string;
	sport: Sport;
	round_number: number;
	scheduled_at: string | null;
	team_1: string;
	team_2: string;
	strokes_1: number | null;
	strokes_2: number | null;
	notes: string | null;
	submitted_by: string | null;
	submitted_by_team: string | null;
	submitted_at: string | null;
	confirmed_by: string | null;
	confirmed_at: string | null;
	status: SubmissionStatus | null;
	created_at: string;
};

export type Tournament = {
	id: number;
	name: string;
	status: TournamentStatus;
	golf_rounds: number;
	disc_golf_rounds: number;
	started_at: string | null;
	ended_at: string | null;
};

export type ActivityLog = {
	id: string;
	created_at: string;
	actor_id: string | null;
	actor_name: string | null;
	actor_role: UserRole | null;
	action: string;
	target_type: string | null;
	target_id: string | null;
	target_label: string | null;
	team_ids: string[];
	summary: string;
	metadata: Record<string, unknown> | null;
};

export type TeamTotals = {
	team_id: string;
	team_name: string;
	team_avatar_url: string | null;
	padel_points: number;
	tennis_points: number;
	disc_golf_points: number;
	golf_points: number;
	total_points: number;
};

type Tbl<R, I = Partial<R>, U = Partial<R>> = {
	Row: R;
	Insert: I;
	Update: U;
	Relationships: [];
};
type View<R> = { Row: R; Relationships: [] };

// Minimal shape compatible with @supabase/postgrest-js generic.
export type Database = {
	public: {
		Tables: {
			profiles: Tbl<
				Profile,
				Partial<Profile> & { id: string; email: string; first_name: string }
			>;
			teams: Tbl<Team, Partial<Team> & { name: string }>;
			team_members: Tbl<TeamMember, TeamMember>;
			player_experience: Tbl<PlayerExperience, PlayerExperience>;
			matches: Tbl<
				Match,
				Partial<Match> & { sport: Sport; team_a: string; team_b: string }
			>;
			flights: Tbl<
				Flight,
				Partial<Flight> & {
					sport: Sport;
					round_number: number;
					team_1: string;
					team_2: string;
				}
			>;
			tournament: Tbl<Tournament, Partial<Tournament>>;
			player_submissions: Tbl<
				PlayerSubmission,
				Partial<PlayerSubmission> & {
					first_name: string;
					last_name: string;
					email: string;
					experience: Record<Sport, ExperienceLevel>;
				}
			>;
			team_submissions: Tbl<
				TeamSubmission,
				Partial<TeamSubmission> & {
					team_name: string;
					player_1_first_name: string;
					player_1_last_name: string;
					player_1_email: string;
					player_1_experience: Record<Sport, ExperienceLevel>;
					player_2_first_name: string;
					player_2_last_name: string;
					player_2_email: string;
					player_2_experience: Record<Sport, ExperienceLevel>;
				}
			>;
			activity_log: Tbl<
				ActivityLog,
				Partial<ActivityLog> & { action: string; summary: string }
			>;
		};
		Views: {
			team_totals: View<TeamTotals>;
			team_sport_points: View<{
				team_id: string;
				sport: Sport;
				points: number;
			}>;
		};
		Functions: {
			submit_match_result: {
				Args: {
					p_match_id: string;
					p_score_a: number;
					p_score_b: number;
					p_notes?: string | null;
				};
				Returns: Match;
			};
			confirm_match_result: { Args: { p_match_id: string }; Returns: Match };
			dispute_match_result: {
				Args: { p_match_id: string; p_reason?: string | null };
				Returns: Match;
			};
			submit_flight_result: {
				Args: {
					p_flight_id: string;
					p_strokes_1: number;
					p_strokes_2: number;
					p_notes?: string | null;
				};
				Returns: Flight;
			};
			confirm_flight_result: { Args: { p_flight_id: string }; Returns: Flight };
			dispute_flight_result: {
				Args: { p_flight_id: string; p_reason?: string | null };
				Returns: Flight;
			};
			generate_round_robin: { Args: Record<string, never>; Returns: number };
			set_user_role: {
				Args: { p_profile_id: string; p_role: UserRole };
				Returns: Profile;
			};
			start_tournament: { Args: Record<string, never>; Returns: Tournament };
			end_tournament: { Args: Record<string, never>; Returns: Tournament };
			reject_player_submission: {
				Args: { p_submission_id: string; p_reason?: string | null };
				Returns: PlayerSubmission;
			};
			reject_team_submission: {
				Args: { p_submission_id: string; p_reason?: string | null };
				Returns: TeamSubmission;
			};
			request_team_name_change: {
				Args: { p_team_id: string; p_new_name: string };
				Returns: Team;
			};
			approve_team_name_change: {
				Args: { p_team_id: string };
				Returns: Team;
			};
			cancel_team_name_change: {
				Args: { p_team_id: string };
				Returns: Team;
			};
			request_team_avatar_change: {
				Args: { p_team_id: string; p_avatar_url: string };
				Returns: Team;
			};
			approve_team_avatar_change: {
				Args: { p_team_id: string };
				Returns: Team;
			};
			cancel_team_avatar_change: {
				Args: { p_team_id: string };
				Returns: Team;
			};
			admin_update_player_nickname: {
				Args: { p_profile_id: string; p_nickname: string };
				Returns: Profile;
			};
		};
		Enums: {
			sport: Sport;
			experience_level: ExperienceLevel;
			user_role: UserRole;
			submission_status: SubmissionStatus;
			tournament_status: TournamentStatus;
		};
		CompositeTypes: Record<string, never>;
	};
};
