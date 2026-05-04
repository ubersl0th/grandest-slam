import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Lenken virker ikke · The Grandest Slam",
	robots: { index: false },
};

type ErrorCopy = {
	title: string;
	body: string;
};

function copyFor(
	code: string | undefined,
	description: string | undefined,
): ErrorCopy {
	switch (code) {
		case "otp_expired":
			return {
				title: "Lenken har utløpt",
				body: "Magiske lenker er kun gyldige i en kort periode. Be om en ny — så får du en frisk lenke på e-post.",
			};
		case "access_denied":
			return {
				title: "Lenken kan ikke brukes",
				body: "Lenken er enten brukt opp, ugyldig eller utløpt. Be om en ny for å logge inn.",
			};
		case "invalid_request":
		case "bad_oauth_callback":
		case "bad_code_verifier":
			return {
				title: "Lenken er ugyldig",
				body: "Vi klarte ikke å verifisere lenken. Prøv å be om en ny innloggingslenke.",
			};
		case "user_not_found":
			return {
				title: "Vi finner deg ikke",
				body: "Vi fant ingen bruker for denne lenken. Sjekk e-postadressen, eller meld deg på via påmeldingsskjemaet.",
			};
		case "server_error":
			return {
				title: "Noe gikk galt på vår side",
				body: "Innloggingen feilet uventet. Prøv igjen om litt — eller be en administrator om hjelp hvis det fortsetter.",
			};
		case "missing_code":
			return {
				title: "Ingen innloggingskode",
				body: "Lenken manglet informasjonen vi trenger for å logge deg inn. Be om en ny lenke.",
			};
		case "verify_failed":
		case "exchange_failed":
		case "set_session_failed":
			return {
				title: "Lenken kunne ikke verifiseres",
				body: "Vi klarte ikke å logge deg inn med denne lenken — den kan være brukt opp, utløpt eller åpnet i en annen nettleser enn der du ba om den. Be om en ny.",
			};
		default:
			if (description) {
				return {
					title: "Innlogging feilet",
					body: description,
				};
			}
			return {
				title: "Innlogging feilet",
				body: "Lenken kunne ikke brukes. Be om en ny lenke for å logge inn.",
			};
	}
}

export default async function AuthErrorPage({
	searchParams,
}: {
	searchParams: Promise<{
		error?: string;
		error_code?: string;
		error_description?: string;
	}>;
}) {
	const params = await searchParams;
	const description = params.error_description?.replace(/\+/g, " ");
	const { title, body } = copyFor(
		params.error_code ?? params.error,
		description,
	);

	return (
		<main className="min-h-dvh px-5 py-10">
			<div className="mx-auto max-w-md">
				<Link
					href="/"
					className="text-sm font-bold opacity-70 hover:opacity-100"
				>
					← Tilbake til forsiden
				</Link>

				<div className="card mt-8 p-6 md:p-8">
					<div
						className="grid h-14 w-14 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-terracotta)] text-2xl text-[var(--color-cream)]"
						aria-hidden
					>
						⚠
					</div>
					<h1
						className="mt-5 text-3xl md:text-4xl"
						style={{ fontFamily: "var(--font-display)" }}
					>
						{title}
					</h1>
					<p className="mt-3 text-[var(--color-ink)]/75">{body}</p>

					{description && params.error_code !== "otp_expired" && (
						<p className="mt-3 text-xs text-[var(--color-ink)]/60">
							Detaljer fra autentiseringsleverandøren: {description}
						</p>
					)}

					<div className="mt-6 flex flex-col gap-2 sm:flex-row">
						<Link
							href="/auth/sign-in"
							className="btn btn-primary flex-1 text-center"
						>
							Send ny lenke
						</Link>
						<Link href="/" className="btn btn-secondary flex-1 text-center">
							Til forsiden
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
