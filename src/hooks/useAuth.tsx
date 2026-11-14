import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getSessionInfo, signOut as signOutFn, type SessionProfile } from "@/lib/auth.functions";

export type Profile = SessionProfile;
export type User = { id: string; email: string };

type AuthValue = {
  session: { user: User } | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  refreshProfile: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["auth-session"],
    queryFn: () => getSessionInfo(),
    staleTime: 30_000,
  });

  const user = data?.user ?? null;
  const profile = (data?.profile ?? null) as Profile | null;

  const value: AuthValue = {
    session: user ? { user } : null,
    user,
    loading: isLoading,
    profile,
    profileLoading: isLoading,
    refreshProfile: () => {
      void queryClient.invalidateQueries({ queryKey: ["auth-session"] });
    },
    signOut: async () => {
      await signOutFn();
      await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
