import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChatCircleDots,
  Compass,
  House,
  NotePencil,
  Plus,
  UserCircle,
  UsersThree,
  Wallet,
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
  { to: "/wallet", label: "Wallet", Icon: Wallet },
  { to: "/profile", label: "Profile", Icon: UserCircle },
] as const;

function useVisibleNav() {
  const { profile } = useAuth();
  const isClient = profile?.role === "client";
  return NAV.filter(({ to }) => !(isClient && to === "/explore"));
}

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = useVisibleNav().filter(({ to }) => to !== "/wallet");
  const inNetwork = pathname.startsWith("/feed");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="flex items-stretch justify-between">
        {items.map(({ to, label, Icon }) => (
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
  const items = useVisibleNav();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:w-[84px] lg:w-[272px]">
      <Link
        to="/home"
        aria-label="Afrixa home"
        className="flex h-[76px] shrink-0 items-center justify-center px-4 lg:justify-start lg:px-6"
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-base font-bold text-sidebar-primary-foreground lg:hidden">
          A
        </span>
        <img
          src={wordmarkImg}
          alt="Afrixa"
          className="hidden h-9 w-auto object-contain brightness-0 invert lg:block"
        />
      </Link>

      <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            title={label}
            aria-label={label}
            activeProps={{ "data-active": "true" } as never}
            className={cn(
              "flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-sm font-semibold text-sidebar-foreground/70 transition-colors",
              "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              "data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground",
              "lg:justify-start",
            )}
          >
            <Icon size={20} weight="bold" className="shrink-0" />
            <span className="hidden lg:block">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("afrixa:open-composer"))}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground transition-opacity hover:opacity-90 lg:justify-start lg:px-3"
        >
          <NotePencil size={18} weight="bold" />
          <span className="hidden lg:block">Create post</span>
        </button>

        <Link
          to="/profile"
          title={profile?.full_name || "Your profile"}
          className="flex items-center justify-center gap-3 rounded-xl p-2 hover:bg-sidebar-accent/50 lg:justify-start"
        >
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-accent text-xs font-bold">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              initials(profile?.full_name)
            )}
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-semibold">
              {profile?.full_name || "Your profile"}
            </span>
            <span className="block text-xs capitalize text-sidebar-foreground/60">
              {profile?.role || "Member"}
            </span>
          </span>
        </Link>
      </div>
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
        "sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3.5 md:px-8 md:py-5",
        dark
          ? "surface-hero border-transparent text-primary-foreground"
          : "border-border/70 bg-background/85 backdrop-blur",
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
        <h1 className="truncate text-lg font-semibold md:text-2xl">{title}</h1>
        {subtitle ? (
          <p
            className={cn(
              "truncate text-xs md:text-sm",
              dark ? "text-white/70" : "text-muted-foreground",
            )}
          >
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
      <div className={cn("min-h-dvh", nav && "md:pl-[84px] lg:pl-[272px]")}>
        <div className={cn(nav && "pb-24 md:pb-10", className)}>
          <div className="mx-auto min-h-dvh w-full max-w-[1180px] border-x border-border/70">{children}</div>
        </div>
      </div>
      {nav ? <BottomNav /> : null}
    </div>
  );
}
