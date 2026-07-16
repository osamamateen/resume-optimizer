import { type AuthTokens, readTokens, writeTokens, clearTokens } from "./tokenStorage";

async function refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const tokens = readTokens();
  if (!tokens) {
    window.location.href = "/login";
    throw new Error("Not authenticated");
  }

  const withAuth = (accessToken: string): RequestInit => ({
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
  });

  let res = await fetch(input, withAuth(tokens.accessToken));

  if (res.status === 401) {
    const refreshed = await refreshTokens(tokens.refreshToken);
    if (!refreshed) {
      clearTokens();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
    writeTokens(refreshed);
    res = await fetch(input, withAuth(refreshed.accessToken));
  }

  return res;
}
