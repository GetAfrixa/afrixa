import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { signIn, signUp } from "@/lib/auth.functions";
import { useAuth } from "@/hooks/useAuth";
import logoImg from "@/assets/afrixa-wordmark.png";
import { COUNTRIES } from "@/lib/afrixa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Search = { mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const mode = search["mode"];
    return mode === "signup" || mode === "signin" ? { mode } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in to Afrixa" },
      {
        name: "description",
        content:
          "Create your Afrixa account or sign in to access verified African talent opportunities and secure escrow payments.",
      },
      { property: "og:title", content: "Sign in to Afrixa" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [isSignUp, setIsSignUp] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"talent" | "client">("talent");
  const [country, setCountry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (mode) setIsSignUp(mode === "signup");
  }, [mode]);

  useEffect(() => {
    if (loading || !user) return;
    if (profile?.onboarding_complete) {
      void navigate({ to: profile.role === "client" ? "/explore" : "/home" });
    } else {
      void navigate({ to: "/onboarding" });
    }
  }, [loading, user, profile, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp({ data: { email, password, fullName, role, country: country || undefined } });
        toast.success("Account created");
      } else {
        await signIn({ data: { email, password } });
        toast.success("Signed in");
      }
      refreshProfile();
      await navigate({ to: "/onboarding" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="surface-hero hidden flex-col justify-between p-12 text-primary-foreground lg:flex">
        <Link to="/" aria-label="Afrixa home" className="inline-flex w-fit rounded-xl bg-white/95 px-3 py-1.5">
          <img src={logoImg} alt="Afrixa" className="h-10 w-auto object-contain" />
        </Link>

        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Pan-African talent network
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-tight">
            Your future
            <br />
            starts here.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/75">
            Verified work, escrow-protected payments and clients who value African talent.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-primary-foreground/80">
            <li className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-gold" /> Jobs, gigs and contracts across Africa
            </li>
            <li className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-gold" /> Get paid in your own currency
            </li>
            <li className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-gold" /> Money released only when work is approved
            </li>
          </ul>
        </div>

        <p className="text-xs text-primary-foreground/50">
          Afrixa - Connect. Discover. Work. Grow. Earn.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-left">
            <Link to="/" className="inline-flex lg:hidden">
              <img src={logoImg} alt="Afrixa" className="mx-auto h-9 w-auto" />
            </Link>
            <h1 className="mt-6 text-2xl font-bold text-foreground md:text-3xl">
              {isSignUp ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isSignUp ? "Join Afrixa to find work or hire talent." : "Sign in to continue."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card md:p-7">
            {isSignUp && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-11" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>I am a</Label>
                    <Select value={role} onValueChange={(v) => setRole(v as "talent" | "client")}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="talent">Talent / Freelancer</SelectItem>
                        <SelectItem value="client">Client / Hiring</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Country</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-11" />
            </div>
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={submitting}>
              {submitting ? "Please wait..." : isSignUp ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button type="button" className="font-semibold text-primary underline" onClick={() => setIsSignUp((v) => !v)}>
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>

          <div className="mt-6 rounded-xl border border-dashed border-border bg-muted/50 p-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            Reviewing the demo? Talent: demo@afrixa.com / afrixa123. Client: client@afrixa.com / afrixa123.
          </div>
        </div>
      </main>
    </div>
  );
}
