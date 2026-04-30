import Image from "next/image";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="relative overflow-x-hidden">
      {/* Hero */}
      <section className="grain relative px-5 pt-10 pb-16 md:pt-16 md:pb-24">
        <Header />

        <div className="mx-auto mt-10 max-w-5xl text-center">
          <p className="tag mx-auto mb-6">Summer 2026 · Teams of two</p>

          <h1
            style={{ fontFamily: "var(--font-display)" }}
            className="text-[14vw] leading-[0.85] tracking-tight md:text-[112px]"
          >
            <span className="block text-[var(--color-terracotta)]">THE</span>
            <span className="block text-[var(--color-ink)]">GRANDEST</span>
            <span className="block text-[var(--color-teal)]">SLAM</span>
          </h1>

          <div className="mx-auto mt-8 flex max-w-md justify-center">
            <Image
              src="/The_Grandest_Slam.webp"
              alt="The Grandest Slam"
              width={320}
              height={320}
              priority
              className="h-auto w-[260px] drop-shadow-[6px_6px_0_rgba(26,20,16,1)]"
            />
          </div>

          <p className="mx-auto mt-8 max-w-xl text-lg md:text-xl text-[var(--color-ink)]/85">
            Four sports. One champion. Padel, Tennis, Disc Golf and Golf —
            played in teams of two over one unforgettable weekend.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link href="/join" className="btn btn-primary">
              Sign up your team →
            </Link>
            <Link href="/leaderboard" className="btn btn-tertiary">
              Live leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Sports strip */}
      <section className="border-y-2 border-[var(--color-ink)] bg-[var(--color-ink)] py-6 overflow-hidden">
        <div className="flex animate-[marquee_30s_linear_infinite] whitespace-nowrap gap-12 text-[var(--color-cream)]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex shrink-0 items-center gap-12 text-2xl md:text-3xl font-black tracking-widest" style={{ fontFamily: "var(--font-display)" }}>
              <span>★ PADEL</span>
              <span>★ TENNIS</span>
              <span>★ DISC GOLF</span>
              <span>★ GOLF</span>
            </div>
          ))}
        </div>
      </section>

      {/* Sports cards */}
      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-3xl md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
            Four arenas, one trophy
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <SportCard
              title="Padel"
              tag="Round Robin"
              points="1pt per win"
              accent="var(--color-terracotta)"
              emoji="🎾"
            />
            <SportCard
              title="Tennis"
              tag="Round Robin"
              points="1pt per win"
              accent="var(--color-mustard)"
              emoji="🎾"
            />
            <SportCard
              title="Disc Golf"
              tag="Stroke play · best disc"
              points="N → 1 pts by ranking"
              accent="var(--color-teal)"
              emoji="🥏"
            />
            <SportCard
              title="Golf"
              tag="Stroke play · best ball"
              points="N → 1 pts by ranking"
              accent="var(--color-plum)"
              emoji="⛳️"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[var(--color-cream-100)] border-y-2 border-[var(--color-ink)] px-5 py-16 md:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-3xl md:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
            How it works
          </h2>
          <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Step n={1} title="Grab a partner" body="Recruit your other half. Pick a name worth printing on a trophy." />
            <Step n={2} title="Sign up your team" body="Two emails, four experience levels, one bio. Done in 60 seconds." />
            <Step n={3} title="Play. Submit. Confirm." body="Submit scores from your phone. Opponents tap to confirm. Leaderboard moves live." />
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-20 text-center">
        <h2 className="text-4xl md:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
          Ready to slam?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-lg text-[var(--color-ink)]/80">
          Lock in your team while spots remain.
        </p>
        <Link href="/join" className="btn btn-primary mt-8">
          Sign up your team →
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
          className="h-9 w-9 rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-mustard)] object-cover"
        />
        <span className="font-black tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
          GRANDEST SLAM
        </span>
      </Link>
      <nav className="flex items-center gap-1 sm:gap-3">
        <Link href="/leaderboard" className="hidden rounded-full px-3 py-2 text-sm font-bold sm:inline">
          Leaderboard
        </Link>
        <Link href="/join" className="btn btn-secondary !py-2 !px-4 !text-sm">
          Join
        </Link>
      </nav>
    </header>
  );
}

function SportCard({
  title,
  tag,
  points,
  accent,
  emoji,
}: {
  title: string;
  tag: string;
  points: string;
  accent: string;
  emoji: string;
}) {
  return (
    <div className="card relative p-6 md:p-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="tag">{tag}</div>
          <h3 className="mt-3 text-3xl md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </h3>
          <p className="mt-2 text-sm font-semibold text-[var(--color-ink)]/70">{points}</p>
        </div>
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-[var(--color-ink)] text-3xl"
          style={{ background: accent }}
        >
          <span>{emoji}</span>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="card p-6">
      <div
        className="grid h-12 w-12 place-items-center rounded-full border-2 border-[var(--color-ink)] bg-[var(--color-mustard)] text-xl font-black"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {n}
      </div>
      <h3 className="mt-4 text-xl font-extrabold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--color-ink)]/75">{body}</p>
    </li>
  );
}

function Footer() {
  return (
    <footer className="border-t-2 border-[var(--color-ink)] bg-[var(--color-ink)] px-5 py-10 text-[var(--color-cream)]">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm opacity-80">© {new Date().getFullYear()} The Grandest Slam</p>
        <div className="flex gap-4 text-sm">
          <Link href="/leaderboard" className="hover:opacity-80">Leaderboard</Link>
          <Link href="/join" className="hover:opacity-80">Sign up</Link>
        </div>
      </div>
    </footer>
  );
}
