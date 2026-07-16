"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <form onSubmit={handleSubmit} className="w-full max-w-sm px-6 py-8 space-y-4">
        <h1 className="text-lg font-medium text-gray-900 dark:text-white">
          Resume<span className="text-blue-600">Tailor</span>
        </h1>
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>
        )}
        <div className="space-y-1">
          <label className="text-sm text-gray-700 dark:text-gray-300" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-gray-700 dark:text-gray-300" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500">At least 8 characters.</p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Already have an account? <a href="/login" className="text-blue-600">Log in</a>
        </p>
      </form>
    </div>
  );
}
