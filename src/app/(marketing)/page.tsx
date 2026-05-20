import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function LandingPage() {
	const user = await getSessionUser();
	if (user) redirect("/dashboard");
	return (
		<main className="relative overflow-x-hidden">
			{/* Hero */}
			<section className="grain relative px-5 pt-10 pb-16 md:pt-16 md:pb-24">
				<Header />

				<div className="mx-auto mt-10 max-w-5xl text-center">
					<p className="tag mx-auto mb-6">Sommer 2026 · Lag på to</p>

					<h1
						style={{ fontFamily: "var(--font-display)" }}
						className="text-[14vw] leading-[0.85] tracking-tight md:text-[112px]"
					>
						<span className="block text-terracotta">THE</span>
						<span className="block text-ink">GRANDEST</span>
						<span className="block text-teal">SLAM</span>
					</h1>

					<div className="mx-auto mt-8 flex max-w-md justify-center">
						<Image
							src="/The_Grandest_Slam.webp"
							alt="The Grandest Slam"
							width={320}
							height={320}
							priority
							className="h-auto w-65 drop-shadow-[6px_6px_0_rgba(26,20,16,1)]"
						/>
					</div>

					<p className="mx-auto mt-8 max-w-xl text-lg md:text-xl text-ink/85">
						Fire idretter. Én mester. Padel, Tennis, Frisbeegolf og Golf — spilt
						i lag på to over én uforglemmelig helg.
					</p>

					<div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
						<Link href="/join" className="btn btn-primary">
							Meld deg på →
						</Link>
						<Link href="/leaderboard" className="btn btn-tertiary">
							Live resultatliste
						</Link>
					</div>
				</div>
			</section>

			{/* Sports strip */}
			<section className="border-y-2 border-ink bg-ink py-6 overflow-hidden">
				<div className="flex w-max animate-[marquee_30s_linear_infinite] whitespace-nowrap text-cream">
					{Array.from({ length: 2 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: only cosmetic element
							key={i}
							aria-hidden={i === 1}
							className="flex shrink-0 items-center gap-12 pr-12 text-2xl md:text-3xl font-black tracking-widest"
							style={{ fontFamily: "var(--font-display)" }}
						>
							<span>★ PADEL</span>
							<span>★ TENNIS</span>
							<span>★ FRISBEEGOLF</span>
							<span>★ GOLF</span>
						</div>
					))}
				</div>
			</section>

			{/* Sports cards */}
			<section className="px-5 py-16 md:py-24">
				<div className="mx-auto max-w-5xl">
					<h2
						className="mb-10 text-center text-3xl md:text-5xl"
						style={{ fontFamily: "var(--font-display)" }}
					>
						Fire arenaer, ett trofé
					</h2>
					<div className="grid grid-cols-1 gap-5 md:grid-cols-2">
						<SportCard
							title="Padel"
							tag="Serieturnering"
							tagTooltip="Alle par møter alle andre par i én kamp hver. Vinnerlaget får 1 poeng per kamp."
							points="1p per seier"
							accent="var(--color-terracotta)"
							emoji="🎾"
						/>
						<SportCard
							title="Tennis"
							tag="Serieturnering"
							tagTooltip="Alle par møter alle andre par i én kamp hver. Vinnerlaget får 1 poeng per kamp."
							points="1p per seier"
							accent="var(--color-mustard)"
							emoji="🎾"
						/>
						<SportCard
							title="Frisbeegolf"
							tag="Slagspill · beste disk"
							tagTooltip="Hvert par spiller én runde og teller den beste disken per hull. Lagene rangeres på total score: best får N poeng, dårligst 1. Hvor N er antall lag."
							points="N → 1 p etter rangering"
							accent="var(--color-teal)"
							emoji="🥏"
						/>
						<SportCard
							title="Golf"
							tag="Slagspill · beste ball"
							tagTooltip="Hvert par spiller én runde og teller det beste slaget per hull. Lagene rangeres på total score: best får N poeng, dårligst 1. Hvor N er antall lag."
							points="N → 1 p etter rangering"
							accent="var(--color-plum)"
							emoji="⛳️"
						/>
					</div>
				</div>
			</section>

			{/* How it works */}
			<section className="bg-cream-100 border-y-2 border-ink px-5 py-16 md:py-24">
				<div className="mx-auto max-w-4xl">
					<h2
						className="mb-12 text-center text-3xl md:text-5xl"
						style={{ fontFamily: "var(--font-display)" }}
					>
						Slik fungerer det
					</h2>
					<ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
						<Step
							n={1}
							title="Meld deg på — alene eller som lag"
							body="Velg «Som enkeltperson» og fyll inn ferdighetsnivå per idrett, eller «Som lag» hvis du allerede har en makker. Tar 60 sekunder."
						/>
						<Step
							n={2}
							title="Admin godkjenner og inviterer"
							body="Enkeltpåmeldte pares til balanserte lag på to; ferdige lag slippes inn som de er. Du får en magisk innloggingslenke på e-post."
						/>
						<Step
							n={3}
							title="Spill. Send inn. Bekreft."
							body="Send poeng fra mobilen. Motstanderne bekrefter med ett trykk, og resultatlisten oppdateres direkte."
						/>
					</ol>
				</div>
			</section>

			{/* CTA */}
			<section className="px-5 py-20 text-center">
				<h2
					className="text-4xl md:text-6xl"
					style={{ fontFamily: "var(--font-display)" }}
				>
					Klar til å slamme?
				</h2>
				<p className="mx-auto mt-4 max-w-md text-lg text-ink/80">
					Sikre plassen din før det er fullt.
				</p>
				<Link href="/join" className="btn btn-primary mt-8">
					Meld deg på →
				</Link>
			</section>

			<Footer />

			<style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
		</main>
	);
}

function Header() {
	return (
		<header className="mx-auto flex max-w-5xl items-center justify-between">
			<Link href="/" className="flex items-center gap-2">
				<Image
					src="/The_Grandest_Slam.webp"
					alt=""
					width={64}
					height={64}
					className="h-9 w-9 rounded-full border-2 border-ink bg-mustard object-cover"
				/>
				<span
					className="font-black tracking-wider"
					style={{ fontFamily: "var(--font-display)" }}
				>
					THE GRANDEST SLAM
				</span>
			</Link>
			<nav className="flex items-center gap-1 sm:gap-3">
				<Link
					href="/leaderboard"
					className="hidden rounded-full px-3 py-2 text-sm font-bold sm:inline"
				>
					Resultatliste
				</Link>
				<Link
					href="/join"
					className="btn btn-secondary py-2 px-4 text-sm whitespace-nowrap"
				>
					Bli med
				</Link>
			</nav>
		</header>
	);
}

function SportCard({
	title,
	tag,
	tagTooltip,
	points,
	accent,
	emoji,
}: {
	title: string;
	tag: string;
	tagTooltip: string;
	points: string;
	accent: string;
	emoji: string;
}) {
	return (
		<div className="card relative p-6 md:p-8">
			<div className="flex items-start justify-between">
				<div>
					<span className="tag">
						{tag}
						<TagTooltip text={tagTooltip} />
					</span>
					<h3
						className="mt-3 text-3xl md:text-4xl"
						style={{ fontFamily: "var(--font-display)" }}
					>
						{title}
					</h3>
					<p className="mt-2 text-sm font-semibold text-ink/70">{points}</p>
				</div>
				<div
					className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-ink text-3xl"
					style={{ background: accent }}
				>
					<span>{emoji}</span>
				</div>
			</div>
		</div>
	);
}

function TagTooltip({ text }: { text: string }) {
	return (
		<span className="group relative -mr-1 inline-flex">
			<button
				type="button"
				aria-label={text}
				className="grid h-4 w-4 cursor-help place-items-center rounded-full border-2 border-ink bg-ink text-[0.55rem] font-black leading-none text-cream"
			>
				?
			</button>
			<span
				role="tooltip"
				className="pointer-events-none absolute top-full left-1/2 z-20 mt-2 w-56 -translate-x-1/2 rounded-xl border-2 border-ink bg-cream-50 px-3 py-2 text-[0.7rem] font-semibold leading-snug tracking-normal text-ink normal-case opacity-0 shadow-[3px_3px_0_var(--color-ink)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
			>
				{text}
			</span>
		</span>
	);
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
	return (
		<li className="card p-6">
			<div
				className="grid h-12 w-12 place-items-center rounded-full border-2 border-ink bg-mustard text-xl font-black"
				style={{ fontFamily: "var(--font-display)" }}
			>
				{n}
			</div>
			<h3 className="mt-4 text-xl font-extrabold">{title}</h3>
			<p className="mt-2 text-sm text-ink/75">{body}</p>
		</li>
	);
}

function Footer() {
	return (
		<footer className="border-t-2 border-ink bg-ink px-5 py-10 text-cream">
			<div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
				<p className="text-sm opacity-80">
					© {new Date().getFullYear()} The Grandest Slam
				</p>
				<div className="flex gap-4 text-sm">
					<Link href="/leaderboard" className="hover:opacity-80">
						Resultatliste
					</Link>
					<Link href="/join" className="hover:opacity-80">
						Meld på
					</Link>
				</div>
			</div>
		</footer>
	);
}
