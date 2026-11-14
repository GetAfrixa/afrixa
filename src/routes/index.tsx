import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import wordmarkImg from "@/assets/afrixa-wordmark.png";
import globeImg from "@/assets/afrixa-globe.png";
import { getLandingOpportunities } from "@/lib/landing.functions";
import { OPPORTUNITY_STATS } from "@/lib/afrixa";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Afrixa - African talent, paid properly" },
      {
        name: "description",
        content:
          "Afrixa connects verified African professionals with clients who fund escrow before work starts. Choose your rate, keep your currency and get paid on delivery.",
      },
      { property: "og:title", content: "Afrixa - African talent, paid properly" },
      {
        property: "og:description",
        content:
          "Find verified work across 54 countries. Every job is funded in escrow before you start.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const TALENT_POINTS = [
  "Set your own rate and keep your currency",
  "Clients fund escrow before work starts",
  "Get matched to work that fits your skills",
];

const CLIENT_POINTS = [
  "Search verified professionals by skill and country",
  "Review proposals with samples and delivery dates",
  "Release payment only when the work is approved",
];

const STEPS = [
  {
    title: "Create a profile",
    body: "Add your skills, portfolio and rate. Verification takes a few minutes and unlocks more work.",
  },
  {
    title: "Get hired",
    body: "Apply to jobs and gigs, or let clients find you in the talent directory.",
  },
  {
    title: "Deliver and get paid",
    body: "The client has already funded escrow. Payment releases when they approve your delivery.",
  },
];

function LandingPage() {
  const { data: opportunities = [] } = useQuery({
    queryKey: ["landing-opportunities"],
    queryFn: () => getLandingOpportunities(),
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen w-full bg-background">
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 md:px-10 md:py-6">
          <Link to="/" aria-label="Afrixa home" className="inline-flex items-center">
            <img
              src={wordmarkImg}
              alt="Afrixa"
              width={430}
              height={143}
              className="h-9 w-auto object-contain brightness-0 invert md:h-10"
            />
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground md:px-4"
            >
              Log in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-11 items-center rounded-lg bg-gold px-4 text-sm font-semibold text-gold-foreground hover:opacity-90 md:px-5"
            >
              Create an account
            </Link>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1180px] px-5 pb-14 pt-10 md:px-10 md:pb-20 md:pt-16">
          <h1 className="max-w-4xl font-display text-[42px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[78px]">
            Good work.
            <br />
            Paid on time.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-primary-foreground/75 md:mt-8 md:text-lg">
            Afrixa connects verified African professionals with clients who fund escrow before
            work starts. You set the rate, you keep the currency, you get paid when you deliver.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row md:mt-10">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-12 items-center justify-center rounded-lg bg-gold px-6 text-sm font-semibold text-gold-foreground hover:opacity-90"
            >
              Create an account
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="inline-flex h-12 items-center justify-center rounded-lg border border-primary-foreground/25 px-6 text-sm font-semibold text-primary-foreground hover:border-primary-foreground/50"
            >
              Log in
            </Link>
          </div>

          <dl className="mt-12 grid max-w-3xl grid-cols-2 gap-x-6 gap-y-6 border-t border-primary-foreground/15 pt-6 md:mt-16 md:grid-cols-4">
            <div>
              <dt className="text-xs text-primary-foreground/60">Countries</dt>
              <dd className="mt-1 font-display text-2xl font-semibold">54</dd>
            </div>
            <div>
              <dt className="text-xs text-primary-foreground/60">Escrow</dt>
              <dd className="mt-1 font-display text-2xl font-semibold">Before work</dd>
            </div>
            <div>
              <dt className="text-xs text-primary-foreground/60">Payouts</dt>
              <dd className="mt-1 font-display text-2xl font-semibold">Local</dd>
            </div>
            <div>
              <dt className="text-xs text-primary-foreground/60">Fees to join</dt>
              <dd className="mt-1 font-display text-2xl font-semibold">None</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-14 md:px-10 md:py-18">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.01em] md:text-3xl">
              Open right now
            </h2>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="text-sm font-semibold text-secondary underline decoration-border underline-offset-4 hover:decoration-secondary"
            >
              See all work
            </Link>
          </div>

          <div className="mt-6 divide-y divide-border border-y border-border">
            {opportunities.length > 0 ? (
              opportunities.map((item) => (
                <Link
                  key={item.id}
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="grid gap-1 py-4 hover:bg-muted/60 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] md:items-center md:gap-6 md:px-2 md:py-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold md:text-base">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.company ?? "Afrixa client"}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground md:text-sm">
                    {item.country ?? "Remote"}
                  </span>
                  <span className="text-xs text-muted-foreground md:text-sm">{item.kind}</span>
                  <span className="text-sm font-semibold md:text-right">{item.budget}</span>
                </Link>
              ))
            ) : OPPORTUNITY_STATS.map((stat) => (
              <div
                key={stat.key}
                className="grid gap-1 py-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] md:items-center md:gap-6 md:px-2 md:py-5"
              >
                <span className="text-sm font-semibold md:text-base">{stat.label}</span>
                <span className="text-xs text-muted-foreground md:text-sm">Across Africa</span>
                <span className="text-xs text-muted-foreground md:text-sm">Open</span>
                <span className="text-sm font-semibold md:text-right">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-14 md:px-10 md:py-20">
          <div className="grid gap-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16">
            <div>
              <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.01em] md:text-4xl">
                Built for African talent first.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
                The supply side of Afrixa is African professionals only. International clients
                come here to hire, and they fund the work before it begins.
              </p>
            </div>

            <ol className="divide-y divide-border border-t border-border">
              {STEPS.map((step, index) => (
                <li key={step.title} className="grid gap-2 py-5 md:grid-cols-[48px_minmax(0,1fr)] md:gap-6 md:py-6">
                  <span className="font-display text-sm font-semibold text-secondary">
                    Step {index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-14 md:px-10 md:py-18">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
            <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.01em] md:text-4xl">
              Money moves after the work, not before it.
            </h2>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              <p>
                When a client hires you, they fund the full amount into escrow. You can see it
                before you start, so you are not chasing invoices in week three.
              </p>
              <p>
                Deliver the work, the client approves it, and the money leaves escrow to your
                balance. If something goes wrong, the dispute sits with Afrixa, not with your bank.
              </p>
            </div>
          </div>

          <img
            src={globeImg}
            alt="Golden pins marking open opportunities across Africa and the world"
            width={768}
            height={276}
            className="globe-blend mt-10 w-full object-contain md:mt-14"
          />
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid w-full max-w-[1180px] md:grid-cols-2 md:divide-x md:divide-border">
          <div className="px-5 py-12 md:px-10 md:py-16 md:pr-12">
            <h2 className="font-display text-2xl font-semibold md:text-3xl">For talent</h2>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground md:text-base">
              {TALENT_POINTS.map((point) => (
                <li key={point} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  {point}
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="mt-7 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Create a profile
            </Link>
          </div>

          <div className="px-5 py-12 md:px-10 md:py-16 md:pl-12">
            <h2 className="font-display text-2xl font-semibold md:text-3xl">For clients</h2>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground md:text-base">
              {CLIENT_POINTS.map((point) => (
                <li key={point} className="border-b border-border pb-3 last:border-0 last:pb-0">
                  {point}
                </li>
              ))}
            </ul>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="mt-7 inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card px-6 text-sm font-semibold hover:bg-muted"
            >
              Post a role
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col items-start gap-6 px-5 py-14 md:flex-row md:items-center md:justify-between md:px-10 md:py-16">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
              Start with a profile.
            </h2>
            <p className="mt-2 text-sm text-primary-foreground/70 md:text-base">
              Free to join. Verification unlocks higher-paying work.
            </p>
          </div>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-gold px-6 text-sm font-semibold text-gold-foreground hover:opacity-90"
          >
            Create an account
          </Link>
        </div>
      </section>

      <footer className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 px-5 pb-8 pt-2 text-xs text-primary-foreground/50 md:flex-row md:items-center md:justify-between md:px-10">
          <span>Afrixa. Built by Africans, for Africa.</span>
          <Link to="/auth" search={{ mode: "signin" }} className="hover:text-primary-foreground">
            Log in
          </Link>
        </div>
      </footer>
    </div>
  );
}
