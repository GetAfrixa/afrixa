import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlass, SealCheck, UsersThree } from "@phosphor-icons/react";
import { toast } from "sonner";

import { AppShell, ScreenHeader } from "@/components/afrixa/AppShell";
import { NotificationBell } from "@/components/afrixa/NotificationBell";
import { PostCard } from "@/components/afrixa/PostCard";
import { PostComposer } from "@/components/afrixa/PostComposer";
import { AddPhotoPrompt } from "@/components/afrixa/AddPhotoPrompt";
import { PersonCard } from "@/components/afrixa/PersonCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/afrixa";
import { fetchFeed, fetchNetwork, fetchPeople, respondToConnection } from "@/lib/social.data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Afrixa Network - post, connect and message" },
      {
        name: "description",
        content:
          "Share posts, follow people, send connection requests and message other African talent and clients on the Afrixa network.",
      },
      { property: "og:title", content: "Afrixa Network" },
      {
        property: "og:description",
        content: "Post updates, find people, follow, connect and chat on Afrixa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NetworkFeedPage,
});

const TABS = [
  { key: "feed", label: "Feed" },
  { key: "people", label: "Find people" },
  { key: "requests", label: "Requests" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function NetworkFeedPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("feed");
  const [term, setTerm] = useState("");
  const queryClient = useQueryClient();

  // The bottom-bar "Post" button switches back to the feed tab where the composer lives.
  useEffect(() => {
    function openComposer() {
      setTab("feed");
    }
    window.addEventListener("afrixa:open-composer", openComposer);
    return () => window.removeEventListener("afrixa:open-composer", openComposer);
  }, []);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["feed", user?.id],
    queryFn: () => fetchFeed({ data: { userId: user?.id } }),
  });

  const { data: people = [], isLoading: peopleLoading } = useQuery({
    queryKey: ["people", user?.id, term],
    enabled: Boolean(user?.id) && tab === "people",
    queryFn: () => fetchPeople({ data: { term } }),
  });

  const { data: network } = useQuery({
    queryKey: ["network", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => fetchNetwork(),
  });

  const respond = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "accepted" | "declined" }) =>
      respondToConnection({ data: { id, status } }),
    onSuccess: (_r, variables) => {
      queryClient.invalidateQueries({ queryKey: ["network"] });
      queryClient.invalidateQueries({ queryKey: ["people"] });
      toast.success(variables.status === "accepted" ? "Connected" : "Request declined");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const incoming = network?.incoming ?? [];
  const outgoing = network?.outgoing ?? [];
  const connected = network?.connected ?? [];

  return (
    <AppShell>
      <ScreenHeader
        title="Network"
        subtitle={`${connected.length} connections · ${incoming.length} requests`}
        action={
          <div className="flex items-center gap-1">
            <Link
              to="/network"
              aria-label="Your connections"
              className="flex size-9 items-center justify-center rounded-full border border-border bg-card"
            >
              <UsersThree size={18} />
            </Link>
            <NotificationBell />
          </div>
        }
      />

      <div className="mx-auto grid w-full max-w-[1060px] gap-6 px-4 pb-8 md:px-8 md:py-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          <div className="mb-3 flex gap-1 rounded-full border border-border bg-card p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "flex-1 rounded-full py-2 text-xs font-semibold transition-colors",
                tab === item.key ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
              {item.key === "requests" && incoming.length > 0 ? ` (${incoming.length})` : ""}
            </button>
            ))}
          </div>

          <div className="space-y-3">
        <AddPhotoPrompt />
        {tab === "feed" ? (
          <>
            <PostComposer />
            {isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading the feed…</p>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <p className="text-sm font-semibold">No posts yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Share your first update - it appears here for everyone on Afrixa.
                </p>
              </div>
            ) : (
              posts.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </>
        ) : null}

        {tab === "people" ? (
          <>
            <div className="relative">
              <MagnifyingGlass
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search people by name, role or skill"
                className="h-12 rounded-xl pl-10"
              />
            </div>
            {peopleLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Finding people…</p>
            ) : people.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No one matches that search yet.
              </p>
            ) : (
              people.map((person) => <PersonCard key={person.id} person={person} />)
            )}
          </>
        ) : null}

        {tab === "requests" ? (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Requests received ({incoming.length})</h2>
              {incoming.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No pending requests right now.
                </p>
              ) : (
                incoming.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                  >
                    <Link
                      to="/talent/$id"
                      params={{ id: row.requester_id }}
                      aria-label={`View ${row.person?.full_name ?? "member"}'s profile`}
                      className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-muted-foreground"
                    >
                      {row.person?.avatar_url ? (
                        <img
                          src={row.person.avatar_url}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        initials(row.person?.full_name ?? "A")
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-semibold">
                        <Link
                          to="/talent/$id"
                          params={{ id: row.requester_id }}
                          className="truncate hover:underline"
                        >
                          {row.person?.full_name ?? "Afrixa member"}
                        </Link>
                        {row.person?.verified ? (
                          <SealCheck size={14} weight="fill" className="text-secondary" />
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.person?.headline ?? row.person?.primary_skill ?? "Afrixa member"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ id: row.id, status: "declined" })}
                      >
                        Ignore
                      </Button>
                      <Button
                        size="sm"
                        disabled={respond.isPending}
                        onClick={() => respond.mutate({ id: row.id, status: "accepted" })}
                      >
                        Accept
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Sent requests ({outgoing.length})</h2>
              {outgoing.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  You have not sent any requests yet.
                </p>
              ) : (
                outgoing.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 text-sm"
                  >
                    <Link
                      to="/talent/$id"
                      params={{ id: row.addressee_id }}
                      className="truncate font-medium hover:underline"
                    >
                      {row.person?.full_name ?? "Afrixa member"}
                    </Link>
                    <span className="text-xs text-muted-foreground">Pending</span>
                  </div>
                ))
              )}
            </section>
          </>
          ) : null}
          </div>
        </div>

        <aside className="hidden space-y-4 lg:block">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="text-sm font-semibold">Your network</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted p-3">
                <p className="text-lg font-bold text-primary">{connected.length}</p>
                <p className="text-[11px] text-muted-foreground">Connections</p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-lg font-bold text-secondary">{incoming.length}</p>
                <p className="text-[11px] text-muted-foreground">Requests</p>
              </div>
            </div>
            <Link
              to="/network"
              className="mt-3 flex h-10 items-center justify-center rounded-lg border border-border text-sm font-semibold hover:bg-muted"
            >
              Manage connections
            </Link>
            <Link
              to="/talent"
              className="mt-2 flex h-10 items-center justify-center rounded-lg border border-border text-sm font-semibold hover:bg-muted"
            >
              Find talent
            </Link>
          </section>

          {connected.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-sm font-semibold">People you know</h2>
              <ul className="mt-3 space-y-3">
                {connected.slice(0, 6).map((row) => (
                  <li key={row.id}>
                    <Link
                      to="/talent/$id"
                      params={{ id: row.person?.id ?? row.requester_id }}
                      className="flex items-center gap-3"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {row.person?.avatar_url ? (
                          <img src={row.person.avatar_url} alt="" className="size-full object-cover" />
                        ) : (
                          initials(row.person?.full_name ?? "A")
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {row.person?.full_name ?? "Afrixa member"}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {row.person?.headline ?? row.person?.primary_skill ?? "Member"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
