import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChatCircleText, MagnifyingGlass, Paperclip } from "@phosphor-icons/react";

import { listConversations } from "@/lib/workspace.functions";
import { AppShell, ScreenHeader } from "@/components/afrixa/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { initials } from "@/lib/afrixa";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({
    meta: [
      { title: "Messages - Afrixa" },
      { name: "description", content: "Chat in real time with your Afrixa connections, clients and talent." },
      { property: "og:title", content: "Messages - Afrixa" },
      { property: "og:description", content: "Real-time chats with messages, photos and files on Afrixa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

type Row = {
  id: string;
  subject: string | null;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  otherHeadline: string | null;
  last_message_at: string;
  preview: string;
  unread: number;
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function MessagesPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => listConversations() as Promise<Row[]>,
    refetchInterval: 5000,
  });

  const filtered = rows.filter((r) => r.otherName.toLowerCase().includes(q.toLowerCase()));

  return (
    <AppShell>
      <ScreenHeader title="Messages" subtitle="Chat with your network in real time" />
      <main className="mx-auto w-full max-w-3xl space-y-3 px-4 md:px-8">
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages" className="bg-card pl-9" />
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading conversations…</p>
        ) : filtered.length ? (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {filtered.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50">
                  <Link
                    to="/talent/$id"
                    params={{ id: r.otherId }}
                    aria-label={`View ${r.otherName}'s profile`}
                    className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {r.otherAvatar ? (
                      <img src={r.otherAvatar} alt="" className="size-12 rounded-full object-cover" />
                    ) : (
                      <span className="surface-hero flex size-12 items-center justify-center rounded-full text-sm font-bold text-primary-foreground">
                        {initials(r.otherName)}
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        to="/talent/$id"
                        params={{ id: r.otherId }}
                        className={cn("truncate text-sm hover:underline", r.unread ? "font-bold" : "font-semibold")}
                      >
                        {r.otherName}
                      </Link>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(r.last_message_at)}</span>
                    </div>
                    <Link
                      to="/messages/$id"
                      params={{ id: r.id }}
                      aria-label={`Open conversation with ${r.otherName}`}
                      className="mt-1 flex items-center justify-between gap-2"
                    >
                      <p className={cn("truncate text-xs", r.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                        {r.preview}
                      </p>
                      {r.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-secondary px-1.5 text-[10px] font-bold text-secondary-foreground">
                          {r.unread}
                        </span>
                      )}
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <section className="rounded-2xl border border-dashed border-border p-8 text-center">
            <ChatCircleText size={32} className="mx-auto text-secondary" />
            <h2 className="mt-3 text-base font-semibold">No conversations yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Find people on the Network page and tap Message to start chatting.
            </p>
            <Link to="/feed" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-secondary">
              <Paperclip size={14} /> Go to Network
            </Link>
          </section>
        )}
      </main>
    </AppShell>
  );
}
