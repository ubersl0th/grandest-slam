type AvatarKind = "player" | "team";

type AvatarProps = {
	src: string | null | undefined;
	name: string | null | undefined;
	size?: number;
	kind?: AvatarKind;
	className?: string;
	ring?: boolean;
};

const PALETTE: { bg: string; ink: string }[] = [
	{ bg: "#e8a838", ink: "#1a1410" },
	{ bg: "#d2502d", ink: "#fbf6e8" },
	{ bg: "#2f7e7a", ink: "#fbf6e8" },
	{ bg: "#6b3464", ink: "#fbf6e8" },
	{ bg: "#efddb1", ink: "#1a1410" },
];

function pickColor(seed: string) {
	let h = 0;
	for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
	return PALETTE[h % PALETTE.length];
}

function initials(name: string | null | undefined, kind: AvatarKind) {
	const trimmed = (name ?? "").trim();
	if (!trimmed) return kind === "team" ? "·" : "?";
	const parts = trimmed.split(/\s+/).filter(Boolean);
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
	src,
	name,
	size = 40,
	kind = "player",
	className = "",
	ring = true,
}: AvatarProps) {
	const dim = `${size}px`;
	const ringCls = ring ? "border-2 border-[var(--color-ink)]" : "";
	const shape = "rounded-full";
	const baseStyle: React.CSSProperties = {
		width: dim,
		height: dim,
		minWidth: dim,
		fontSize: Math.max(10, Math.round(size * 0.4)),
	};
	if (src) {
		return (
			// biome-ignore lint/performance/noImgElement: avatar URL is dynamic Supabase public URL
			<img
				src={src}
				alt=""
				width={size}
				height={size}
				loading="lazy"
				decoding="async"
				className={`${shape} ${ringCls} object-cover bg-[var(--color-cream-200)] ${className}`}
				style={baseStyle}
			/>
		);
	}
	const seed = `${name ?? "?"}:${kind}`;
	const color = pickColor(seed);
	return (
		<span
			className={`${shape} ${ringCls} inline-grid place-items-center font-black tracking-wider ${className}`}
			style={{
				...baseStyle,
				backgroundColor: color.bg,
				color: color.ink,
				fontFamily: "var(--font-display)",
			}}
			aria-hidden
		>
			{initials(name, kind)}
		</span>
	);
}

type LabelProps = {
	name: string | null | undefined;
	avatarUrl: string | null | undefined;
	kind?: AvatarKind;
	size?: number;
	className?: string;
	textClassName?: string;
};

export function NameWithAvatar({
	name,
	avatarUrl,
	kind = "player",
	size = 28,
	className = "",
	textClassName = "",
}: LabelProps) {
	return (
		<span
			className={`inline-flex min-w-0 items-center gap-2 ${className}`}
			style={{ minHeight: size }}
		>
			<Avatar src={avatarUrl} name={name} kind={kind} size={size} />
			<span className={`min-w-0 truncate ${textClassName}`}>{name ?? "—"}</span>
		</span>
	);
}
