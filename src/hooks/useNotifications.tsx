import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from "@/lib/notifications.functions";

export type { Notification };

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ["notifications", userId],
    enabled: Boolean(userId),
    queryFn: () => listNotifications(),
    refetchInterval: 15000, // polling replaces Supabase realtime
  });

  const items = query.data ?? [];
  const unread = items.filter((item) => !item.read_at).length;

  async function markAllRead() {
    if (!userId || !unread) return;
    await markAllNotificationsRead();
    await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  async function markRead(id: string) {
    if (!userId) return;
    await markNotificationRead({ data: { id } });
    await queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  }

  return { items, unread, isLoading: query.isLoading, markAllRead, markRead };
}
