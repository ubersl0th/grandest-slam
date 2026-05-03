import type { ExperienceLevel, Sport } from "@/lib/database.types";
import { EXPERIENCE_WEIGHTS, SPORTS } from "@/lib/sports";

export type BalancePlayer = {
	id: string;
	experience: Record<Sport, ExperienceLevel>;
};

export type BalancePair = [BalancePlayer, BalancePlayer];

export type BalanceResult = {
	pairs: BalancePair[];
	unassigned: BalancePlayer | null;
	cost: number;
	perSportSpread: Record<Sport, { min: number; max: number; variance: number }>;
};

function pairSkill(pair: BalancePair, sport: Sport): number {
	return (
		EXPERIENCE_WEIGHTS[pair[0].experience[sport]] +
		EXPERIENCE_WEIGHTS[pair[1].experience[sport]]
	);
}

// Sum of per-sport variance across all sports. Lower is more balanced.
function totalCost(pairs: BalancePair[]): number {
	if (pairs.length === 0) return 0;
	let total = 0;
	for (const s of SPORTS) {
		const skills = pairs.map((p) => pairSkill(p, s.key));
		const mean = skills.reduce((a, b) => a + b, 0) / skills.length;
		const variance =
			skills.reduce((acc, x) => acc + (x - mean) ** 2, 0) / skills.length;
		total += variance;
	}
	return total;
}

function shuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function makePairs(players: BalancePlayer[]): BalancePair[] {
	const shuffled = shuffle(players);
	const pairs: BalancePair[] = [];
	for (let i = 0; i + 1 < shuffled.length; i += 2) {
		pairs.push([shuffled[i], shuffled[i + 1]]);
	}
	return pairs;
}

// Random-swap hill-climbing. Try swapping one player between two random pairs;
// keep the swap if it lowers cost.
function hillClimb(
	initial: BalancePair[],
	iterations: number,
): { pairs: BalancePair[]; cost: number } {
	let best = initial.map((p) => [...p] as BalancePair);
	let bestCost = totalCost(best);
	if (best.length < 2) return { pairs: best, cost: bestCost };
	for (let i = 0; i < iterations; i++) {
		const i1 = Math.floor(Math.random() * best.length);
		let i2 = Math.floor(Math.random() * best.length);
		while (i2 === i1) i2 = Math.floor(Math.random() * best.length);
		const j1 = Math.floor(Math.random() * 2);
		const j2 = Math.floor(Math.random() * 2);
		const candidate = best.map((p) => [...p] as BalancePair);
		const tmp = candidate[i1][j1];
		candidate[i1][j1] = candidate[i2][j2];
		candidate[i2][j2] = tmp;
		const c = totalCost(candidate);
		if (c < bestCost) {
			best = candidate;
			bestCost = c;
		}
	}
	return { pairs: best, cost: bestCost };
}

function balance(
	players: BalancePlayer[],
	iterations = 600,
	restarts = 12,
): { pairs: BalancePair[]; cost: number } {
	if (players.length < 2) return { pairs: [], cost: 0 };
	let best: { pairs: BalancePair[]; cost: number } | null = null;
	for (let r = 0; r < restarts; r++) {
		const result = hillClimb(makePairs(players), iterations);
		if (!best || result.cost < best.cost) best = result;
	}
	if (!best) throw "Found no best pair";
	return best;
}

function summarize(pairs: BalancePair[]): BalanceResult["perSportSpread"] {
	const out = {} as BalanceResult["perSportSpread"];
	for (const s of SPORTS) {
		if (pairs.length === 0) {
			out[s.key] = { min: 0, max: 0, variance: 0 };
			continue;
		}
		const skills = pairs.map((p) => pairSkill(p, s.key));
		const min = Math.min(...skills);
		const max = Math.max(...skills);
		const mean = skills.reduce((a, b) => a + b, 0) / skills.length;
		const variance =
			skills.reduce((acc, x) => acc + (x - mean) ** 2, 0) / skills.length;
		out[s.key] = { min, max, variance };
	}
	return out;
}

// Build balanced 2-player teams. With an odd count, one player is left out;
// the algorithm tries each possible left-out player and picks the lowest-cost
// configuration.
export function generateBalancedTeams(players: BalancePlayer[]): BalanceResult {
	if (players.length < 2) {
		return {
			pairs: [],
			unassigned: players[0] ?? null,
			cost: 0,
			perSportSpread: summarize([]),
		};
	}
	if (players.length % 2 === 0) {
		const r = balance(players);
		return {
			pairs: r.pairs,
			unassigned: null,
			cost: r.cost,
			perSportSpread: summarize(r.pairs),
		};
	}
	let best: {
		pairs: BalancePair[];
		cost: number;
		unassigned: BalancePlayer;
	} | null = null;
	for (let i = 0; i < players.length; i++) {
		const subset = players.filter((_, idx) => idx !== i);
		const r = balance(subset);
		if (!best || r.cost < best.cost) {
			best = { pairs: r.pairs, cost: r.cost, unassigned: players[i] };
		}
	}
	if (!best) throw "No best pair";
	return {
		pairs: best.pairs,
		unassigned: best.unassigned,
		cost: best.cost,
		perSportSpread: summarize(best.pairs),
	};
}
