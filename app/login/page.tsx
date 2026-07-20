"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary relative flex items-center p-[6vw] pl-[clamp(24px,8vw,120px)]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[380px] flex flex-col gap-[26px]">
        <div className="text-[19px] font-medium tracking-[-0.015em]">
          Resume<span className="text-accent">Tailor</span>
        </div>

        <div className="bg-surface rounded-card p-[28px] shadow-[var(--card-shadow)]">
          <h1 className="text-[22px] font-medium mb-1 tracking-[-0.015em]">Welcome back</h1>
          <p className="text-[13px] text-text-secondary mb-[22px]">
            Log in to keep tailoring your resume.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
            {error && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div>
              <label className="block text-[12px] mb-[5px] text-text-secondary" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full min-h-[36px] px-[10px] py-[6px] text-[14px] text-text-primary bg-bg border border-border-hairline rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] mb-[5px] text-text-secondary" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[36px] px-[10px] py-[6px] text-[14px] text-text-primary bg-bg border border-border-hairline rounded-lg outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex items-center justify-center gap-[6px] w-full px-4 py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="text-[13px] text-text-secondary mt-[18px] text-left">
            New here?{" "}
            <a href="/signup" className="text-accent no-underline">
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
