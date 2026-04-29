import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · The Grandest Slam" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className="min-h-dvh px-5 py-10">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm font-bold opacity-70 hover:opacity-100">
          ← Back home
        </Link>
        <h1
          className="mt-6 text-4xl md:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Sign in
        </h1>
        <p className="mt-2 text-[var(--color-ink)]/75">
          We&apos;ll email you a magic link.
        </p>
        {error === "link" && (
          <div className="card mt-4 border-[var(--color-terracotta)] bg-[var(--color-terracotta)]/10 p-4 text-sm font-bold text-[var(--color-terracotta-dark)]">
            That link is invalid or expired. Try again.
          </div>
        )}
        <SignInForm next={next} />
      </div>
    </main>
  );
}
