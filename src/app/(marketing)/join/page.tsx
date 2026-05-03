import Link from "next/link";
import { JoinForm } from "./join-form";

export const metadata = { title: "Sign up · The Grandest Slam" };

export default function JoinPage() {
  return (
    <main className="min-h-dvh px-5 py-8 md:py-14">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-bold opacity-70 hover:opacity-100"
        >
          ← Back home
        </Link>
        <h1
          className="mt-6 text-4xl md:text-6xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-[var(--color-terracotta)]">Sign up</span>
          <br />
          for the slam
        </h1>
        <p className="mt-3 max-w-md text-[var(--color-ink)]/75">
          Four sports, one weekend. Sign up as an individual — admins will pair
          everyone into balanced teams of two and email you a magic link.
        </p>

        <JoinForm />
      </div>
    </main>
  );
}
