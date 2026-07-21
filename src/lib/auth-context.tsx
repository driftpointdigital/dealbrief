"use client";
// Client-side auth + account state. Wraps the app (see layout.tsx) and exposes
// the signed-in user plus an account summary (free-run availability, subscription
// status, runs used this period) that the R&A gate reads to decide access.
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";

export type AccountSummary = {
  email: string | null;
  freeRunAvailable: boolean;
  subscription: { status: string; includedRuns: number; periodStart: string | null } | null;
  runsThisPeriod: number;
  // True when the user may run at least one more report right now (free run
  // available, or an active subscription — overage keeps this true).
  canRun: boolean;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  account: AccountSummary | null;
  accountLoading: boolean;
  refreshAccount: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = supabaseBrowser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  const refreshAccount = useCallback(async () => {
    setAccountLoading(true);
    try {
      const res = await fetch("/api/account", { cache: "no-store" });
      if (res.ok) setAccount(await res.json());
      else setAccount(null);
    } catch {
      setAccount(null);
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Whenever the signed-in user changes, refresh the account summary.
  useEffect(() => {
    if (user) refreshAccount();
    else setAccount(null);
  }, [user, refreshAccount]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message ?? null };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAccount(null);
  }, [supabase]);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        account,
        accountLoading,
        refreshAccount,
        signInWithPassword,
        signUpWithPassword,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within <AuthProvider>");
  return c;
}
