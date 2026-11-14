import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  Camera,
  Certificate,
  CreditCard,
  Gear,
  Plus,
  ShieldCheck,
  SignOut,
  Users,
  Wallet,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
  addPortfolioItem as addPortfolioItemFn,
  escrowBalance as escrowBalanceFn,
  listAssessments,
  listPortfolio,
  setDiscoverable as setDiscoverableFn,
  updateAvatar,
} from "@/lib/workspace.functions";
import { AppShell, ScreenHeader } from "@/components/afrixa/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { uploadUserFile } from "@/lib/uploads";
import { initials, money } from "@/lib/afrixa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ProfileDossierEditor } from "@/components/afrixa/ProfileDossierEditor";
import { Progress } from "@/components/ui/progress";


export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile - Afrixa" },
      {
        name: "description",
        content: "Review your Afrixa profile, portfolio, skills verification and account progress.",
      },
      { property: "og:title", content: "Profile - Afrixa" },
      {
        property: "og:description",
        content: "Afrixa profile, portfolio and verified work reputation in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const { unread } = useNotifications();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState({ title: "", category: "" });

  const discoverable = (profile as { discoverable?: boolean } | null)?.discoverable ?? true;

  const { data: escrowBalance = 0 } = useQuery({
    queryKey: ["escrow-balance", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => escrowBalanceFn(),
  });

  async function onAvatarPicked(file: File | undefined) {
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return void toast.error("Please choose an image file");
    if (file.size > 5 * 1024 * 1024) return void toast.error("Photo must be under 5MB");
    setBusy(true);
    try {
      const url = await uploadUserFile("avatars", user.id, file);
      await updateAvatar({ data: { avatarUrl: url } });
      refreshProfile();
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDiscoverable(next: boolean) {
    if (!user) return;
    try {
      await setDiscoverableFn({ data: { discoverable: next } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update visibility");
      return;
    }
    refreshProfile();
    toast.success(next ? "You are visible to clients" : "Hidden from talent search");
  }

  async function addPortfolioItem() {
    if (!user || !newItem.title.trim()) return;
    setBusy(true);
    try {
      await addPortfolioItemFn({
        data: { title: newItem.title.trim(), category: newItem.category.trim() || null },
      });
      setNewItem({ title: "", category: "" });
      await queryClient.invalidateQueries({ queryKey: ["portfolio", user.id] });
      toast.success("Portfolio item added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save item");
    } finally {
      setBusy(false);
    }
  }


  const { data: portfolio = [] } = useQuery({
    queryKey: ["portfolio", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listPortfolio(),
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["assessments", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listAssessments(),
  });

  const latestAssessment = assessments[0];

  return (
    <AppShell>
      <ScreenHeader
        title="Profile"
        subtitle={profile?.role === "client" ? "Hiring account" : "Talent account"}
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="relative flex size-9 items-center justify-center rounded-full border border-border bg-card"
            >
              <Bell size={18} />
              {unread ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-secondary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <Link
              to="/payment-setup"
              aria-label="Payment settings"
              className="flex size-9 items-center justify-center rounded-full border border-border bg-card"
            >
              <Gear size={18} />
            </Link>
          </div>
        }
      />

      <main className="space-y-5 px-4 py-4 md:px-8 md:py-6">
        <section className="surface-hero overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-lift md:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => avatarInput.current?.click()}
              disabled={busy}
              aria-label="Change profile photo"
              className="relative size-20 shrink-0 overflow-hidden rounded-3xl bg-white/15 md:size-24"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile photo" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-2xl font-bold">
                  {initials(profile?.full_name)}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/40 py-1">
                <Camera size={13} weight="bold" />
              </span>
            </button>
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void onAvatarPicked(event.target.files?.[0])}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className="rounded-full bg-white/15 px-2.5 py-1 capitalize">
                  {profile?.role ?? "member"}
                </span>
                {profile?.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                    <ShieldCheck size={13} weight="fill" /> Verified
                  </span>
                ) : (
                  <Link
                    to="/verify"
                    className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-foreground"
                  >
                    <ShieldCheck size={13} /> Get verified
                  </Link>
                )}
                {profile?.country ? (
                  <span className="rounded-full bg-white/15 px-2.5 py-1">{profile.country}</span>
                ) : null}
              </div>
              <h2 className="mt-2 truncate text-2xl font-bold md:text-3xl">
                {profile?.full_name ?? "Afrixa member"}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-primary-foreground/75 md:text-base">
                {profile?.headline ?? profile?.business_name ?? "Ready for verified work"}
              </p>
              {profile?.bio ? (
                <p className="mt-3 max-w-2xl text-sm text-primary-foreground/80">{profile.bio}</p>
              ) : null}
              {user ? (
                <Link
                  to="/talent/$id"
                  params={{ id: user.id }}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4 decoration-white/40"
                >
                  View public profile <ArrowRight size={14} />
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
          <div className="space-y-5">
            <section className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-xs text-muted-foreground">Profile strength</p>
                <p className="mt-1 text-xl font-bold text-secondary">
                  {profile?.profile_strength ?? 0}%
                </p>
                <Progress value={profile?.profile_strength ?? 0} className="mt-3 h-1.5" />
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-xs text-muted-foreground">In escrow</p>
                <p className="mt-1 text-xl font-bold">{money(escrowBalance)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <p className="text-xs text-muted-foreground">Total earned</p>
                <p className="mt-1 text-xl font-bold">{money(profile?.total_earned ?? 0)}</p>
              </div>
            </section>

            {profile?.role === "client" ? null : (
              <ProfileDossierEditor
                userId={user!.id}
                hourlyRate={profile?.hourly_rate ?? null}
                onRateSaved={refreshProfile}
              />
            )}

            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Portfolio</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Work samples clients can scan in seconds
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {portfolio.length}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {portfolio.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-border bg-background p-4"
                  >
                    <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.category ?? "Portfolio item"}
                    </p>
                  </article>
                ))}
                {portfolio.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground sm:col-span-2">
                    Add portfolio work to strengthen your profile.
                  </p>
                ) : null}
              </div>

              <div className="mt-4 grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-[1.4fr_1fr_auto]">
                <Input
                  value={newItem.title}
                  onChange={(event) => setNewItem((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Project title"
                  className="h-11 rounded-lg"
                />
                <Input
                  value={newItem.category}
                  onChange={(event) =>
                    setNewItem((prev) => ({ ...prev, category: event.target.value }))
                  }
                  placeholder="Category (optional)"
                  className="h-11 rounded-lg"
                />
                <Button
                  className="h-11 rounded-lg sm:px-4"
                  disabled={busy || !newItem.title.trim()}
                  onClick={() => void addPortfolioItem()}
                >
                  <Plus size={16} /> Add
                </Button>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Skill assessment</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {latestAssessment
                      ? `${latestAssessment.level} - ${latestAssessment.score}%`
                      : "Earn a visible skills badge"}
                  </p>
                </div>
                <Link
                  to="/assessment"
                  aria-label="Open assessment"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
                >
                  <Certificate size={18} weight="bold" />
                </Link>
              </div>
              {latestAssessment ? (
                <div className="mt-4 space-y-2">
                  {assessments.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="truncate pr-3">{item.skill}</span>
                      <span className="font-semibold text-secondary">{item.score}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Button asChild variant="outline" className="mt-4 h-10 w-full rounded-lg">
                  <Link to="/assessment">Take the assessment</Link>
                </Button>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-base font-semibold">Verification</h2>
              {profile?.verified ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-secondary">
                  <ShieldCheck size={18} weight="fill" /> Identity verified
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Verified members get more replies and higher-paying work.
                  </p>
                  <Button asChild className="mt-3 h-10 w-full rounded-lg">
                    <Link to="/verify">Verify identity</Link>
                  </Button>
                </>
              )}
            </section>

            {profile?.role === "client" ? (
              <section className="grid grid-cols-2 gap-3">
                <Link
                  to="/proposals"
                  className="rounded-2xl border border-border bg-card p-4 text-sm font-semibold shadow-card transition-colors hover:border-secondary"
                >
                  <Certificate size={20} className="mb-2 text-primary" /> Proposals
                </Link>
                <Link
                  to="/talent"
                  className="rounded-2xl border border-border bg-card p-4 text-sm font-semibold shadow-card transition-colors hover:border-secondary"
                >
                  <Users size={20} className="mb-2 text-secondary" /> Find talent
                </Link>
              </section>
            ) : (
              <section className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="pr-3">
                  <h2 className="text-base font-semibold">Discoverable</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Let clients find you in talent search
                  </p>
                </div>
                <Switch
                  checked={discoverable}
                  onCheckedChange={(next) => void toggleDiscoverable(next)}
                />
              </section>
            )}

            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-base font-semibold">Account</h2>
              <div className="mt-3 space-y-1">
                <Link
                  to="/wallet"
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  <Wallet size={18} className="text-secondary" /> Wallet and escrows
                  <ArrowRight size={14} className="ml-auto text-muted-foreground" />
                </Link>
                <Link
                  to="/payment-setup"
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  <CreditCard size={18} className="text-secondary" /> Payout methods
                  <ArrowRight size={14} className="ml-auto text-muted-foreground" />
                </Link>
                <Link
                  to="/notifications"
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  <Bell size={18} className="text-secondary" /> Notifications
                  <ArrowRight size={14} className="ml-auto text-muted-foreground" />
                </Link>
              </div>
            </section>

            <Button
              variant="outline"
              className="h-12 w-full rounded-xl bg-card"
              onClick={() => signOut()}
            >
              <SignOut size={16} /> Sign out
            </Button>
          </div>
        </div>
      </main>
    </AppShell>
  );
}