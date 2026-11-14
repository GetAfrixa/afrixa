import { useRef, type MouseEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import wordmarkImg from "@/assets/afrixa-wordmark.png";
import globeImg from "@/assets/afrixa-globe.png";
import walletImg from "@/assets/home-wallet-banner.jpg";
import networkImg from "@/assets/home-network-banner.jpg";
import opportunityImg from "@/assets/home-opportunity-banner.jpg";
import { getLandingOpportunities } from "@/lib/landing.functions";
import { OPPORTUNITY_STATS } from "@/lib/afrixa";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Afrixa - Hire African talent, paid on delivery" },
      {
        name: "description",
        content:
          "Afrixa connects verified African professionals with clients who fund escrow before work starts. Choose your rate, keep your currency and get paid on delivery.",
      },
      { property: "og:title", content: "Afrixa - Hire African talent, paid on delivery" },
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

const TICKER = [
  "Product design",
  "Engineering",
  "Data",
  "Growth",
  "Brand",
  "Finance",
  "Support",
  "Writing",
  "Nigeria",
  "Kenya",
  "Ghana",
  "South Africa",
  "Egypt",
  "Rwanda",
  "Morocco",
  "Senegal",
];

const STEPS = [
  {
    title: "Create a profile",
    body: "Add your skills, portfolio and rate. Verification takes minutes and unlocks higher paying work.",
  },
  {
    title: "Get hired",
    body: "Apply to jobs and gigs, or let clients find you in the talent directory by skill and country.",
  },
  {
    title: "Deliver and get paid",
    body: "The client funded escrow before you started. Payment releases the moment they approve delivery.",
  },
];

const TALENT_POINTS = [
  "Set your own rate and keep your currency",
  "Escrow is funded before work starts",
  "Matched to work that fits your skills",
];

const CLIENT_POINTS = [
  "Search verified professionals by skill",
  "Review proposals with samples and dates",
  "Release payment only when approved",
];

const COUNTRY_MARKS = [
  { city: "Lagos", left: "45%", top: "58%" },
  { city: "Nairobi", left: "63%", top: "66%" },
  { city: "Cairo", left: "58%", top: "34%" },
  { city: "Cape Town", left: "48%", top: "84%" },
];

function LandingPage() {
  const { data: opportunities = [] } = useQuery({
    queryKey: ["landing-opportunities"],
    queryFn: () => getLandingOpportunities(),
    staleTime: 60_000,
  });

  const stageRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  function handleStageMove(event: MouseEvent<HTMLDivElement>) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    stage.style.setProperty("--rx", `${(-y * 12).toFixed(2)}deg`);
    stage.style.setProperty("--ry", `${(x * 16).toFixed(2)}deg`);
  }

  function resetStage() {
    stageRef.current?.style.setProperty("--rx", "0deg");
    stageRef.current?.style.setProperty("--ry", "0deg");
  }

  function handlePanelMove(event: MouseEvent<HTMLDivElement>) {
    const panel = tiltRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    panel.style.setProperty("--px", `${(-y * 6).toFixed(2)}deg`);
    panel.style.setProperty("--py", `${(x * 8).toFixed(2)}deg`);
  }

  function resetPanel() {
    tiltRef.current?.style.setProperty("--px", "0deg");
    tiltRef.current?.style.setProperty("--py", "0deg");
  }

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between border-x border-primary-foreground/10 px-5 py-5 md:px-10 md:py-6">
          <Link to="/" aria-label="Afrixa home" className="inline-flex items-center">
            <img
              src={wordmarkImg}
              alt="Afrixa"
              width={430}
              height={143}
              className="h-9 w-auto object-contain brightness-0 invert md:h-10"
            />
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-primary-foreground/70 md:flex">
            <a className="hover:text-primary-foreground" href="#work">
              Open work
            </a>
            <a className="hover:text-primary-foreground" href="#how">
              How it works
            </a>
            <a className="hover:text-primary-foreground" href="#escrow">
              Escrow
            </a>
          </nav>

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

        <div className="mx-auto grid w-full max-w-[1180px] gap-10 border-x border-primary-foreground/10 px-5 pb-16 pt-10 md:px-10 md:pb-24 md:pt-16 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center lg:gap-6">
          <div className="relative z-10">
            <p className="flex items-center gap-2 text-sm font-medium text-gold">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Escrow funded hiring across 54 countries
            </p>
            <h1 className="mt-5 font-display text-[46px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-6xl lg:text-[82px]">
              Good work.
              <br />
              <span className="text-gold">Paid on time.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-primary-foreground/75 md:text-lg">
              Afrixa connects verified African professionals with clients who fund escrow before
              work starts. You set the rate, you keep the currency, you get paid when you deliver.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
                Browse open work
              </Link>
            </div>

            <div className="mt-9 flex items-center gap-4 border-t border-primary-foreground/15 pt-6">
              <div className="flex -space-x-2">
                {["AO", "KM", "TN", "BJ"].map((initials) => (
                  <span
                    key={initials}
                    className="grid h-8 w-8 place-items-center rounded-full border border-primary-foreground/25 bg-secondary text-[10px] font-semibold text-primary-foreground"
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-primary-foreground/60">
                Verified designers, engineers and operators.
                <br className="hidden sm:block" /> Every profile checked before it goes live.
              </p>
            </div>
          </div>

          <div
            ref={stageRef}
            onMouseMove={handleStageMove}
            onMouseLeave={resetStage}
            className="globe-stage hero-tilt relative mx-auto hidden aspect-square w-full max-w-[430px] lg:block"
          >
            <div className="globe-core" />
            <div className="globe-rotor">
              {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5].map((angle) => (
                <div
                  key={angle}
                  className="globe-ring"
                  style={{ transform: `rotateY(${angle}deg)` }}
                />
              ))}
              <div className="globe-ring" style={{ transform: "rotateX(90deg)" }} />
            </div>

            <div className="globe-orbit">
              <span className="globe-orbit-dot" />
            </div>

            {COUNTRY_MARKS.map((mark) => (
              <span
                key={mark.city}
                className="globe-pin"
                style={{ left: mark.left, top: mark.top }}
                aria-hidden="true"
              />
            ))}

            <div className="chip-float absolute -left-6 top-10 w-[186px] rounded-xl border border-primary-foreground/15 bg-primary/85 p-3 backdrop-blur">
              <p className="text-[10px] font-medium text-primary-foreground/55">Escrow funded</p>
              <p className="mt-0.5 font-display text-xl font-semibold">$2,400</p>
              <p className="text-[10px] text-primary-foreground/55">Brand identity, Lagos</p>
            </div>

            <div className="chip-float-slow absolute -right-4 bottom-16 w-[196px] rounded-xl border border-primary-foreground/15 bg-primary/85 p-3 backdrop-blur">
              <p className="text-[10px] font-medium text-primary-foreground/55">
                Payment released
              </p>
              <p className="mt-0.5 font-display text-xl font-semibold">NGN 1,860,000</p>
              <p className="text-[10px] text-primary-foreground/55">Delivery approved</p>
            </div>

            <div className="absolute inset-x-10 -bottom-5 h-10 rounded-[100%] bg-black/35 blur-2xl" />
          </div>
        </div>

        <div className="relative w-full overflow-hidden">
          <img
            src={globeImg}
            alt="Golden pins marking open opportunities across Africa"
            className="earth-map h-[210px] w-[190%] max-w-none -translate-x-[24%] object-cover object-bottom sm:h-[260px] md:h-auto md:w-full md:translate-x-0 md:object-contain"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-primary to-transparent md:h-20" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-px bg-primary-foreground/10 md:block" />
        </div>
      </section>

      {/* Ticker */}
      <div className="overflow-hidden border-y border-border bg-gold text-gold-foreground">
        <div className="marquee-track flex w-max items-center gap-8 py-3 text-sm font-semibold">
          {[...TICKER, ...TICKER].map((item, index) => (
            <span key={`${item}-${index}`} className="flex items-center gap-8">
              {item}
              <span className="h-1 w-1 rounded-full bg-gold-foreground/40" />
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1180px] border-x border-border bg-background">
        {/* Open work */}
        <section id="work" className="border-b border-border">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-5 py-8 md:px-10 md:py-10">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium text-secondary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
                </span>
                Live from the marketplace
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
                Open right now
              </h2>
            </div>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
            >
              See all work
            </Link>
          </div>

          <div
            className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-6 border-b border-border bg-muted/40 px-6 py-3 text-xs font-medium text-muted-foreground md:grid md:px-10"
            aria-hidden="true"
          >
            <span>Role</span>
            <span>Location</span>
            <span>Type</span>
            <span className="text-right">Budget</span>
          </div>

          <div className="divide-y divide-border">
            {opportunities.length > 0
              ? opportunities.map((item) => (
                  <Link
                    key={item.id}
                    to="/auth"
                    search={{ mode: "signup" }}
                    className="grid gap-1 px-5 py-4 hover:bg-muted/50 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] md:items-center md:gap-6 md:px-10 md:py-5"
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
                    <span className="text-xs md:text-sm">
                      <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                        {item.kind}
                      </span>
                    </span>
                    <span className="text-sm font-semibold md:text-right">{item.budget}</span>
                  </Link>
                ))
              : OPPORTUNITY_STATS.map((stat) => (
                  <div
                    key={stat.key}
                    className="grid gap-1 px-5 py-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] md:items-center md:gap-6 md:px-10 md:py-5"
                  >
                    <span className="text-sm font-semibold md:text-base">{stat.label}</span>
                    <span className="text-xs text-muted-foreground md:text-sm">Across Africa</span>
                    <span className="text-xs md:text-sm">
                      <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                        Open
                      </span>
                    </span>
                    <span className="text-sm font-semibold md:text-right">{stat.value}</span>
                  </div>
                ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-b border-border">
          <div className="grid border-b border-border md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="border-b border-border px-5 py-10 md:border-b-0 md:border-r md:px-10 md:py-14">
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-5xl">
                Built for African talent first.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
                The supply side of Afrixa is African professionals only. International clients come
                here to hire, and they fund the work before it begins.
              </p>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="mt-7 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Create a profile
              </Link>
            </div>

            <ol className="divide-y divide-border">
              {STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="group grid gap-3 px-5 py-7 transition-colors hover:bg-muted/40 md:grid-cols-[64px_minmax(0,1fr)] md:gap-6 md:px-10 md:py-9"
                >
                  <span className="font-display text-2xl font-semibold text-border transition-colors group-hover:text-secondary">
                    0{index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold md:text-lg">{step.title}</h3>
                    <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border md:grid-cols-4">
            {[
              ["54", "Countries covered"],
              ["Before work", "Escrow funding"],
              ["Local", "Currency payouts"],
              ["Free", "Fees to join"],
            ].map(([value, label], index) => (
              <div
                key={label}
                className={`px-5 py-6 md:px-8 md:py-8 ${index < 2 ? "border-b border-border md:border-b-0" : ""}`}
              >
                <p className="font-display text-2xl font-semibold md:text-3xl">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground md:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Escrow */}
        <section id="escrow" className="border-b border-border">
          <div className="grid md:grid-cols-2">
            <div className="border-b border-border px-5 py-10 md:border-b-0 md:border-r md:px-10 md:py-14">
              <p className="text-xs font-medium text-secondary">Escrow, explained</p>
              <h2 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-[-0.02em] md:text-4xl">
                Money moves after the work, not before it.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
                When a client hires you they fund the full amount into escrow. You can see it before
                you start, so you are not chasing invoices in week three.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                Deliver the work, the client approves it, and the money leaves escrow to your
                balance. If something goes wrong, the dispute sits with Afrixa, not your bank.
              </p>

              <div className="mt-7 divide-y divide-border border-y border-border">
                {[
                  ["Client funds escrow", "Full amount, before kickoff"],
                  ["You deliver", "Milestones tracked in one place"],
                  ["Payment releases", "Sent to your local account"],
                ].map(([title, detail]) => (
                  <div key={title} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm font-semibold">{title}</span>
                    <span className="text-right text-xs text-muted-foreground">{detail}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex items-center justify-center bg-muted/50 px-5 py-10 md:px-10 md:py-14">
              <div
                ref={tiltRef}
                onMouseMove={handlePanelMove}
                onMouseLeave={resetPanel}
                className="panel-tilt relative w-full max-w-[440px]"
              >
                <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]">
                  <img
                    src={walletImg}
                    alt="Afrixa wallet with escrow balance"
                    className="h-40 w-full object-cover md:h-48"
                    loading="lazy"
                  />
                  <div className="space-y-3 p-5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>In escrow</span>
                      <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5">
                        Secured
                      </span>
                    </div>
                    <p className="font-display text-3xl font-semibold">$2,400</p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-2/3 rounded-full bg-secondary" />
                    </div>
                    <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                      <span className="text-muted-foreground">Milestone 2 of 3</span>
                      <span className="font-semibold">Releases on approval</span>
                    </div>
                  </div>
                </div>

                <div className="chip-float absolute -right-3 -top-4 rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
                  <p className="text-[10px] text-muted-foreground">Escrow funded</p>
                  <p className="text-sm font-semibold">Brand identity</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Talent and clients */}
        <section id="talent" className="grid border-b border-border md:grid-cols-2">
          <div className="group relative isolate overflow-hidden border-b border-border md:border-b-0 md:border-r">
            <img
              src={networkImg}
              alt="African professionals collaborating"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-primary/85" />
            <div className="relative flex h-full flex-col justify-between px-5 py-10 text-primary-foreground md:px-10 md:py-12">
              <div>
                <h2 className="font-display text-3xl font-semibold md:text-4xl">For talent</h2>
                <ul className="mt-6 divide-y divide-primary-foreground/15 border-y border-primary-foreground/15">
                  {TALENT_POINTS.map((point) => (
                    <li key={point} className="py-3 text-sm text-primary-foreground/80 md:text-base">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-lg bg-gold px-6 text-sm font-semibold text-gold-foreground hover:opacity-90 sm:w-auto sm:self-start"
              >
                Create a profile
              </Link>
            </div>
          </div>

          <div className="group relative isolate overflow-hidden">
            <img
              src={opportunityImg}
              alt="Client reviewing proposals"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-background/90" />
            <div className="relative flex h-full flex-col justify-between px-5 py-10 md:px-10 md:py-12">
              <div>
                <h2 className="font-display text-3xl font-semibold md:text-4xl">For clients</h2>
                <ul className="mt-6 divide-y divide-border border-y border-border">
                  {CLIENT_POINTS.map((point) => (
                    <li key={point} className="py-3 text-sm text-muted-foreground md:text-base">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-lg border border-border bg-card px-6 text-sm font-semibold hover:bg-muted sm:w-auto sm:self-start"
              >
                Post a role
              </Link>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="relative overflow-hidden bg-primary px-5 py-14 text-primary-foreground md:px-10 md:py-20">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-primary-foreground/10" />
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full border border-primary-foreground/10" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-64 w-64 rounded-full border border-primary-foreground/10" />

          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] md:text-5xl">
                Start with a profile.
              </h2>
              <p className="mt-3 max-w-md text-sm text-primary-foreground/70 md:text-base">
                Free to join. Verification unlocks higher paying work and faster matches.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
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
                className="inline-flex h-12 items-center justify-center rounded-lg border border-primary-foreground/25 px-6 text-sm font-semibold hover:border-primary-foreground/50"
              >
                Log in
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="border-t border-primary-foreground/10 bg-primary text-primary-foreground">
        <div className="mx-auto w-full max-w-[1180px] border-x border-primary-foreground/10 px-5 py-10 md:px-10">
          <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <img
                src={wordmarkImg}
                alt="Afrixa"
                className="h-9 w-auto object-contain brightness-0 invert"
                width={430}
                height={143}
              />
              <p className="mt-4 max-w-xs text-xs leading-relaxed text-primary-foreground/60">
                Built by Africans, for Africa. Verified work, funded before it starts.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold">Platform</p>
              <ul className="mt-3 space-y-2 text-xs text-primary-foreground/60">
                <li>
                  <a className="hover:text-primary-foreground" href="#work">
                    Open work
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary-foreground" href="#how">
                    How it works
                  </a>
                </li>
                <li>
                  <a className="hover:text-primary-foreground" href="#escrow">
                    Escrow
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold">Account</p>
              <ul className="mt-3 space-y-2 text-xs text-primary-foreground/60">
                <li>
                  <Link className="hover:text-primary-foreground" to="/auth" search={{ mode: "signup" }}>
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-primary-foreground" to="/auth" search={{ mode: "signin" }}>
                    Log in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold">Reach us</p>
              <ul className="mt-3 space-y-2 text-xs text-primary-foreground/60">
                <li>hello@afrixa.com</li>
                <li>Lagos, Nigeria</li>
                <li>Mon to Fri, 9am to 6pm WAT</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-primary-foreground/15 pt-5 text-xs text-primary-foreground/55 sm:flex-row sm:items-center sm:justify-between">
            <span>Afrixa. Built by Africans, for Africa.</span>
            <span>Escrow held until delivery is approved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
