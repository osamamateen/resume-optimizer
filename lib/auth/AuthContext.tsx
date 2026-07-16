"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  type AuthTokens,
  getTokensSnapshot,
  getServerTokensSnapshot,
  subscribeTokens,
  writeTokens,
  clearTokens,
} from "./tokenStorage";

interface AuthContextValue {
  accessToken: string | null;
  refreshToken: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function postJson(url: string, body: unknown): Promise<AuthTokens> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(typeof errBody.error === "string" ? errBody.error : "Request failed");
  }
  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const tokens = useSyncExternalStore(subscribeTokens, getTokensSnapshot, getServerTokensSnapshot);
  const accessToken = tokens?.accessToken ?? null;
  const refreshToken = tokens?.refreshToken ?? null;

  // getServerTokensSnapshot() always returns null (no localStorage on the
  // server), so the first client render matches SSR and briefly reports
  // "logged out" even for a returning user. `ready` distinguishes that
  // one-render hydration gap from an actual missing session, so callers
  // (e.g. the redirect-to-login effect in app/page.tsx) don't act on it.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // One-time post-hydration mount flag; there's no external system to
    // subscribe to here, just the SSR/client hydration boundary itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    writeTokens(await postJson("/api/auth/login", { email, password }));
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    writeTokens(await postJson("/api/auth/signup", { email, password }));
  }, []);

  const logout = useCallback(async () => {
    if (refreshToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    clearTokens();
  }, [refreshToken]);

  return (
    <AuthContext.Provider value={{ accessToken, refreshToken, ready, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
