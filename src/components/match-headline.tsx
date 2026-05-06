type Props = {
	teamAName: string;
	teamBName: string;
	// "a"/"b" only when the winner is final (confirmed). null otherwise.
	winnerSide: "a" | "b" | null;
	className?: string;
};

export function MatchHeadline({
	teamAName,
	teamBName,
	winnerSide,
	className,
}: Props) {
	const aWon = winnerSide === "a";
	const bWon = winnerSide === "b";
	const sideClass = (won: boolean, otherWon: boolean) =>
		won ? "font-black" : otherWon ? "font-medium opacity-50" : "font-extrabold";
	return (
		<p className={`break-words ${className ?? ""}`}>
			<span className={sideClass(aWon, bWon)}>
				{aWon && (
					<span aria-hidden className="mr-1">
						🏆
					</span>
				)}
				{teamAName}
			</span>
			<span className="mx-1 font-medium opacity-50">vs</span>
			<span className={sideClass(bWon, aWon)}>
				{teamBName}
				{bWon && (
					<span aria-hidden className="ml-1">
						🏆
					</span>
				)}
			</span>
		</p>
	);
}
