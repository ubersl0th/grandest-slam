import Link from "next/link";
import { JoinForm } from "./join-form";

export const metadata = { title: "Meld på · The Grandest Slam" };

export default function JoinPage() {
	return (
		<main className="min-h-dvh px-5 py-8 md:py-14">
			<div className="mx-auto max-w-2xl">
				<Link
					href="/"
					className="text-sm font-bold opacity-70 hover:opacity-100"
				>
					← Tilbake til forsiden
				</Link>
				<h1
					className="mt-6 text-4xl md:text-6xl"
					style={{ fontFamily: "var(--font-display)" }}
				>
					<span className="text-[var(--color-terracotta)]">Meld deg på</span>
					<br />
					slammet
				</h1>
				<p className="mt-3 max-w-md text-[var(--color-ink)]/75">
					Fire idretter, én helg. Meld deg på som enkeltperson —
					administratorene setter sammen balanserte lag på to og sender deg en
					magisk lenke på e-post.
				</p>

				<JoinForm />
			</div>
		</main>
	);
}
