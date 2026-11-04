import { createFileRoute, Link } from "@tanstack/react-router";

import wordmarkImg from "@/assets/afrixa-wordmark.png";
import globeImg from "@/assets/afrixa-globe.png";
import { OPPORTUNITY_STATS } from "@/lib/afrixa";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Afrixa — Africa's Talent, Global Opportunities" },
      {
        name: "description",
        content:
          "Join Afrixa to find verified, escrow-funded jobs, gigs and freelance work across 54+ African countries and internationally.",
      },
      { property: "og:title", content: "Afrixa — Africa's Talent, Global Opportunities" },
      {
        property: "og:description",
        content: "Build your career, get paid securely and grow without borders with Afrixa.",
      },
    ],
  }),
  component: Intro,
});

const WHY = [
  "Only African talent on the supply side",
  "International clients are buyers only",
  "Local payments in your currency",
  "Opportunities across 54+ countries",
  "Built by Africans, for Africa",
];

function Intro() {
  return (
    <div className="min-h-screen w-full bg-background">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-center px-6 pt-6 md:justify-start md:px-10 md:pt-8">
        <Link
          to="/"
          aria-label="Afrixa home"
          className="inline-flex rounded-2xl bg-white px-3 py-1.5 shadow-card ring-1 ring-primary/5"
        >
          <img
            src={wordmarkImg}
            alt="Afrixa"
            width={430}
            height={143}
            className="h-12 w-auto md:h-14"
          />
        </Link>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-7xl items-center gap-3 px-6 pb-8 pt-6 md:grid-cols-2 md:gap-8 md:px-10 md:py-10 lg:gap-14 lg:py-12">
          <div className="text-center md:text-left">
            <p className="text-[10px] font-bold tracking-[0.25em] text-secondary md:text-xs">
              CONNECT · EMPOWER · GROW
            </p>
            <h1 className="mt-5 text-[32px] font-bold leading-[1.12] text-primary md:mt-4 md:text-5xl lg:text-6xl">
              Your Future
              <br />
              Starts Here.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground md:mx-0 md:mt-5 md:text-base lg:text-lg">
              The Pan-African platform that connects your skills to real opportunities.
            </p>

            <div className="mx-auto mt-7 max-w-sm md:mx-0 md:mt-8">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lift transition-colors hover:bg-primary/90"
              >
                Get Started
              </Link>
              <p className="mt-3 text-center text-xs text-muted-foreground md:text-left">
                Already have an account?{" "}
                <Link
                  to="/auth"
                  search={{ mode: "signin" }}
                  className="font-semibold text-gold underline"
                >
                  Log in
                </Link>
              </p>
            </div>
          </div>

          <div className="relative flex min-h-48 items-center justify-center md:min-h-80 lg:min-h-[26rem]">
            <div className="absolute inset-4 rounded-full bg-secondary/10 blur-3xl" />
            <img
              src={globeImg}
              alt="A globe with golden pins marking opportunities across Africa and the world"
              width={768}
              height={276}
              className="globe-blend relative w-full max-w-3xl object-contain"
            />
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10 md:py-10">
          <h2 className="text-center text-[22px] font-semibold md:text-left md:text-2xl">
            Active opportunities
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {OPPORTUNITY_STATS.map((stat) => (
              <div
                key={stat.key}
                className="rounded-2xl border border-border bg-card p-4 shadow-card md:p-6"
              >
                <p className="text-xl font-bold text-secondary md:text-2xl">{stat.value}</p>
                <p className="text-xs text-muted-foreground md:mt-1 md:text-sm">
                  {stat.label} available
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-8 px-6 pb-14 pt-4 md:grid-cols-2 md:items-center md:gap-14 md:px-10 md:pb-20 md:pt-8">
          <div>
            <h2 className="text-[22px] font-semibold md:text-3xl">Why Afrixa?</h2>
            <ul className="mt-4 space-y-3">
              {WHY.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-muted-foreground md:text-base">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="surface-hero rounded-3xl p-6 text-primary-foreground shadow-card md:p-10">
            <p className="text-xl font-semibold leading-snug md:text-3xl">
              Your success story starts here.
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-primary-foreground/75 md:text-base">
              Discover meaningful work, build your network and grow your career across borders.
            </p>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="mt-5 inline-flex h-11 items-center rounded-xl bg-white/15 px-5 text-sm font-semibold transition-colors hover:bg-white/25"
            >
              Explore Opportunities →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
