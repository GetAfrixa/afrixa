import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatCircleDots, ShieldCheck, UserPlus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useState } from "react";

import { AppShell, ScreenHeader } from "@/components/afrixa/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/afrixa";
import { getConnectionStatus, openDirectConversation, requestConnection } from "@/lib/social.data";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ProfileDossierView } from "@/components/afrixa/ProfileDossier";
import { fetchPortfolioItems, fetchProfileDossier, fetchPublicProfile } from "@/lib/profile.data";
import { fetchFeed } from "@/lib/social.data";
import { PostCard } from "@/components/afrixa/PostCard";

export const Route = createFileRoute("/_authenticated/talent/$id")({
  head: () => ({
    meta: [
      { title: "Member profile - Afrixa" },
      {
        name: "description",
        content: "View an Afrixa member's profile, skills, portfolio work and recent activity.",
      },
      { property: "og:title", content: "Member profile - Afrixa" },
      {
        property: "og:description",
        content: "Explore an Afrixa member's profile, portfolio and activity.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TalentProfileRoute,
});

function TalentProfileRoute() {
  const { id } = Route.useParams();
  return <PublicProfilePage id={id} />;
}

export function PublicProfilePage({ id }: { id: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [contacting, setContacting] = useState(false);

  const { data: connection } = useQuery({
    queryKey: ["connection", user?.id, id],
    enabled: Boolean(user?.id) && user?.id !== id,
    queryFn: () => getConnectionStatus({ data: { otherId: id } }),
  });

  const connect = useMutation({
    mutationFn: () => requestConnection({ data: { addresseeId: id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connection"] });
      queryClient.invalidateQueries({ queryKey: ["network"] });
      toast.success("Invitation sent");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const connectLabel =
    connection?.status === "accepted"
      ? "Connected"
      : connection?.status === "pending"
        ? "Invite pending"
        : "Connect";

  const { data: person, isLoading } = useQuery({
    queryKey: ["talent", id],
    queryFn: () => fetchPublicProfile({ data: { id } }),
  });

  const { data: dossier } = useQuery({
    queryKey: ["dossier", id],
    queryFn: () => fetchProfileDossier({ data: { userId: id } }),
  });

  const { data: portfolio = [] } = useQuery({
    queryKey: ["talent-portfolio", id],
    queryFn: () => fetchPortfolioItems({ data: { userId: id } }),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["feed", "author", id],
    queryFn: () => fetchFeed({ data: { userId: user?.id, authorId: id } }),
  });

  async function contact() {
    if (!user) return;
    setContacting(true);
    try {
      const conversationId = await openDirectConversation({ data: { otherId: id } });
      await navigate({ to: "/messages/$id", params: { id: conversationId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the conversation");
    } finally {
      setContacting(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <ScreenHeader title="Profile" back />
        <p className="px-4 text-sm text-muted-foreground">Loading profile…</p>
      </AppShell>
    );
  }

  if (!person) {
    return (
      <AppShell>
        <ScreenHeader title="Profile" back />
        <p className="px-4 text-sm text-muted-foreground">This profile is not available.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ScreenHeader
        title={person.full_name || "Profile"}
        subtitle={person.primary_skill ?? "Afrixa member"}
        back
      />
      <main className="mx-auto w-full max-w-[1060px] px-4 py-4 pb-8 md:px-8 md:py-6">
        <section className="surface-hero rounded-2xl p-5 text-primary-foreground shadow-lift md:rounded-3xl md:p-7">
          <div className="flex items-start gap-4 md:items-center md:gap-6">
            {person.avatar_url ? (
              <img
                src={person.avatar_url}
                alt={person.full_name}
                className="size-16 rounded-2xl object-cover md:size-24"
              />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold md:size-24 md:text-2xl">
                {initials(person.full_name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-xl font-bold md:text-3xl">{person.full_name}</h2>
                {person.verified ? <ShieldCheck size={16} weight="fill" /> : null}
              </div>
              <p className="mt-1 text-sm text-primary-foreground/75 md:text-base">
                {person.headline ?? "Available for work"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] md:text-xs">
                {person.country ? (
                  <span className="rounded-full bg-white/15 px-2.5 py-1">{person.country}</span>
                ) : null}
                {person.years_experience ? (
                  <span className="rounded-full bg-white/15 px-2.5 py-1">
                    {person.years_experience}
                  </span>
                ) : null}
                {person.hourly_rate ? (
                  <span className="rounded-full bg-white/15 px-2.5 py-1">
                    ${person.hourly_rate}/hr
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="order-first space-y-3 lg:order-last lg:sticky lg:top-24">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-card lg:flex-col">
              <Button className="h-12 flex-1 lg:w-full" disabled={contacting} onClick={() => void contact()}>
                <ChatCircleDots size={16} /> {contacting ? "Opening chat…" : "Message"}
              </Button>
              {user?.id !== id ? (
                <Button
                  variant="outline"
                  className="h-12 flex-1 lg:w-full"
                  disabled={Boolean(connection) || connect.isPending}
                  onClick={() => connect.mutate()}
                >
                  <UserPlus size={16} /> {connect.isPending ? "Sending…" : connectLabel}
                </Button>
              ) : null}
            </div>

            <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Profile strength</p>
                <p className="text-xs font-bold text-secondary">{person.profile_strength}%</p>
              </div>
              <Progress value={person.profile_strength} className="mt-2 h-2" />
            </section>
          </div>

          <div className="space-y-5">
            {person.bio ? (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <h2 className="text-base font-semibold">About</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{person.bio}</p>
              </section>
            ) : null}

            {dossier ? <ProfileDossierView dossier={dossier} /> : null}

            <section>
              <h2 className="text-base font-semibold">Portfolio</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {portfolio.length ? (
                  portfolio.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-border bg-card p-4 shadow-card"
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="mb-3 h-36 w-full rounded-xl object-cover"
                        />
                      ) : null}
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.category ?? "Work sample"}
                      </p>
                      {item.link_url ? (
                        <a
                          href={item.link_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-2 block truncate text-xs font-semibold text-primary hover:underline"
                        >
                          View work sample
                        </a>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground sm:col-span-2">
                    No portfolio work published yet.
                  </p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-base font-semibold">Activity</h2>
              <div className="mt-3 space-y-3">
                {posts.length ? (
                  posts.map((post) => <PostCard key={post.id} post={post} />)
                ) : (
                  <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                    No posts yet.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
