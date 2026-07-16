"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { type AuthTokens, readTokens, writeTokens, clearTokens } from "./tokenStorage";

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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readTokens();
    if (stored) {
      setAccessToken(stored.accessToken);
      setRefreshToken(stored.refreshToken);
    }
    setReady(true);
  }, []);

  const applyTokens = useCallback((tokens: AuthTokens) => {
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    writeTokens(tokens);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      applyTokens(await postJson("/api/auth/login", { email, password }));
    },
    [applyTokens]
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      applyTokens(await postJson("/api/auth/signup", { email, password }));
    },
    [applyTokens]
  );

  const logout = useCallback(async () => {
    if (refreshToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
    setAccessToken(null);
    setRefreshToken(null);
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
