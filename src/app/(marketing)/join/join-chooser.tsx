"use client";

import { useState } from "react";
import { JoinForm } from "./join-form";
import { TeamJoinForm } from "./team-form";

type Mode = "solo" | "team";

export function JoinChooser() {
	const [mode, setMode] = useState<Mode>("solo");

	return (
		<div className="mt-8">
			<div
				role="tablist"
				aria-label="Velg påmeldingstype"
				className="grid grid-cols-2 gap-2 rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-cream-50)] p-1"
			>
				<ModeTab
					active={mode === "solo"}
					onClick={() => setMode("solo")}
					label="Som enkeltperson"
					sub="Bli paret av admin"
				/>
				<ModeTab
					active={mode === "team"}
					onClick={() => setMode("team")}
					label="Som lag"
					sub="Du har allerede makker"
				/>
			</div>

			{mode === "solo" ? <JoinForm /> : <TeamJoinForm />}
		</div>
	);
}

function ModeTab({
	active,
	onClick,
	label,
	sub,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
	sub: string;
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onClick}
			className={`rounded-full px-3 py-2 text-center transition ${
				active
					? "bg-[var(--color-ink)] text-[var(--color-cream)]"
					: "text-[var(--color-ink)] hover:bg-[var(--color-cream-200)]"
			}`}
		>
			<span className="block text-sm font-extrabold">{label}</span>
			<span
				className={`block text-[10px] font-bold uppercase tracking-widest ${
					active ? "opacity-80" : "opacity-60"
				}`}
			>
				{sub}
			</span>
		</button>
	);
}
