import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MagnifyingGlass, SlidersHorizontal } from "@phosphor-icons/react";

import { searchOpportunities } from "@/lib/workspace.functions";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, ScreenHeader } from "@/components/afrixa/AppShell";
import { GigCard, OpportunityCard } from "@/components/afrixa/OpportunityCard";
import { COUNTRIES, type Opportunity } from "@/lib/afrixa";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Search = { category?: string; q?: string };

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "job", label: "Jobs" },
  { key: "gig", label: "Gigs" },
  { key: "freelance", label: "Freelance" },
  { key: "internship", label: "Internships" },
  { key: "grant", label: "Grants" },
];

export const Route = createFileRoute("/_authenticated/explore")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const parsed: Search = {};
    const category = search["category"];
    const q = search["q"];
    if (typeof category === "string") parsed.category = category;
    if (typeof q === "string") parsed.q = q;
    return parsed;
  },
  head: () => ({
    meta: [
      { title: "Explore opportunities on Afrixa" },
      {
        name: "description",
        content:
          "Search and filter jobs, gigs, freelance projects, internships and grants by country, budget and skill.",
      },
      { property: "og:title", content: "Explore opportunities on Afrixa" },
      {
        property: "og:description",
        content: "Filter escrow-funded work by category, country and skill.",
      },
    ],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  const { category = "all", q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { profile } = useAuth();

  useEffect(() => {
    if (profile && profile.role === "client") {
      navigate({ to: "/home", replace: true });
    }
  }, [profile, navigate]);

  const [query, setQuery] = useState(q ?? "");
  const [country, setCountry] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["opportunities", category, query, country],
    queryFn: () =>
      searchOpportunities({
        data: { category, country, query: query.trim(), limit: 50 },
      }) as Promise<Opportunity[]>,
  });

  return (
    <AppShell>
      <ScreenHeader title="Explore" subtitle="Verified, escrow-protected work" />

      <div className="mx-auto w-full max-w-[1060px] space-y-4 px-4 py-4 pb-8 md:px-8 md:py-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search opportunities"
              className="h-12 bg-card pl-10"
            />
          </div>
          <button
            type="button"
            aria-label="Filters"
            onClick={() => setShowFilters((open) => !open)}
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-md border md:hidden",
              showFilters ? "border-secondary text-secondary" : "border-border bg-card",
            )}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>

        {showFilters ? (
          <div className={cn("rounded-2xl border border-border bg-card p-4 md:flex md:items-center md:gap-4", showFilters ? "block" : "hidden md:flex")}>
            <p className="mb-2 text-xs font-medium text-muted-foreground md:mb-0 md:shrink-0">Country</p>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="h-11 md:w-64">
                <SelectValue placeholder="Any country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any country</SelectItem>
                {COUNTRIES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
          {CATEGORIES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                navigate({
                  to: ".",
                  search: item.key === "all" ? {} : { category: item.key },
                })
              }
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
                category === item.key
                  ? "border-secondary bg-secondary/10 text-secondary"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium">No matches</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different category, country or keyword.
            </p>
          </div>
        ) : category === "gig" ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {results.map((item) => (
              <GigCard key={item.id} opportunity={item} />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {results.map((item) => (
              <OpportunityCard key={item.id} opportunity={item} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
