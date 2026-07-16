export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEY = "resume-optimizer-auth";

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedTokens: AuthTokens | null = null;

function parse(raw: string | null): AuthTokens | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function readTokens(): AuthTokens | null {
  return parse(window.localStorage.getItem(STORAGE_KEY));
}

export function getTokensSnapshot(): AuthTokens | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedTokens = parse(raw);
  }
  return cachedTokens;
}

export function getServerTokensSnapshot(): AuthTokens | null {
  return null;
}

export function subscribeTokens(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function writeTokens(tokens: AuthTokens): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  notify();
}

export function clearTokens(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  notify();
}
