import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  ChatCircleDots,
  Compass,
  House,
  NotePencil,
  Plus,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";
import { CaretLeft } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import wordmarkImg from "@/assets/afrixa-wordmark.png";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/afrixa";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/home", label: "Home", Icon: House },
  { to: "/explore", label: "Explore", Icon: Compass },
  { to: "/gigs", label: "Gigs", Icon: Plus },
  { to: "/feed", label: "Network", Icon: UsersThree },
  { to: "/messages", label: "Chats", Icon: ChatCircleDots },
  { to: "/profile", label: "Profile", Icon: UserCircle },
] as const;

export function BottomNav() {
  const { profile } = useAuth();
  const isClient = profile?.role === "client";
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const inNetwork = pathname.startsWith("/feed");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="flex items-stretch justify-between">
        {NAV.filter(({ to }) => !(isClient && to === "/explore")).map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            {inNetwork && label === "Gigs" ? (
              <button
                type="button"
                aria-label="Create a post"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("afrixa:open-composer"));
                }}
                className="group flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors"
              >
                <span className="surface-hero -mt-5 flex size-11 items-center justify-center rounded-2xl text-primary-foreground shadow-lift">
                  <NotePencil size={22} weight="bold" />
                </span>
                <span>Post</span>
              </button>
            ) : (
              <Link
                to={to}
                activeProps={{ "data-active": "true" } as never}
                className="group flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors data-[active=true]:text-primary"
              >
                {label === "Gigs" ? (
                  <span className="surface-hero -mt-5 flex size-11 items-center justify-center rounded-2xl text-primary-foreground shadow-lift">
                    <Icon size={22} weight="bold" />
                  </span>
                ) : (
                  <Icon size={22} className="shrink-0" />
                )}
                <span>{label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function DesktopNav() {
  const { profile } = useAuth();
  const isClient = profile?.role === "client";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-border bg-card md:flex lg:w-64">
      <Link
        to="/home"
        aria-label="Afrixa home"
        className="flex h-20 items-center justify-center border-b border-border px-4 lg:justify-start"
      >
        <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground lg:hidden">
          A
        </span>
        <img
          src={wordmarkImg}
          alt="Afrixa"
          className="hidden h-10 w-auto object-contain lg:block"
        />
      </Link>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 px-3 py-6">
        {NAV.filter(({ to }) => !(isClient && to === "/explore")).map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            title={label}
            aria-label={label}
            activeProps={{ "data-active": "true" } as never}
            className="flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary lg:justify-start"
          >
            <Icon size={21} weight="bold" className="shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </Link>
        ))}
      </nav>

      <Link
        to="/profile"
        title={profile?.full_name || "Your profile"}
        className="flex items-center justify-center gap-3 border-t border-border p-4 hover:bg-muted lg:justify-start"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {initials(profile?.full_name)}
        </span>
        <span className="hidden min-w-0 lg:block">
          <span className="block truncate text-sm font-semibold">
            {profile?.full_name || "Your profile"}
          </span>
          <span className="block text-xs capitalize text-muted-foreground">
            {profile?.role || "Member"}
          </span>
        </span>
      </Link>
    </aside>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  back,
  action,
  tone = "light",
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const dark = tone === "dark";
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 px-4 py-4",
        dark ? "surface-hero text-primary-foreground" : "bg-background/90 backdrop-blur",
      )}
    >
      {back ? (
        <button
          type="button"
          aria-label="Go back"
          onClick={() => router.history.back()}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full border",
            dark ? "border-white/20" : "border-border bg-card",
          )}
        >
          <CaretLeft size={18} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold">{title}</h1>
        {subtitle ? (
          <p className={cn("truncate text-xs", dark ? "text-white/70" : "text-muted-foreground")}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}

export function AppShell({
  children,
  nav = true,
  className,
}: {
  children: ReactNode;
  nav?: boolean;
  className?: string;
}) {
  return (
    <div className="min-h-dvh w-full bg-background">
      {nav ? <DesktopNav /> : null}
      <div className={cn("min-h-dvh", nav && "md:pl-20 lg:pl-64")}>
        <div className={cn(nav && "pb-24 md:pb-8", className)}>
          <div className="mx-auto min-h-dvh w-full max-w-7xl">{children}</div>
        </div>
      </div>
      {nav ? <BottomNav /> : null}
    </div>
  );
}
