"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MasterResumeControl } from "@/components/MasterResumeControl";

interface ApplicationSummary {
  id: string;
  companyName: string;
  roleTitle: string;
  atsScore: number;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const { accessToken, ready, logout } = useAuth();
  const [applications, setApplications] = useState<ApplicationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !accessToken) {
      router.push("/login");
    }
  }, [ready, accessToken, router]);

  useEffect(() => {
    if (!accessToken) return;
    authFetch("/api/applications")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load applications");
        const data = await res.json();
        setApplications(data.applications);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load applications"));
  }, [accessToken]);

  if (!ready || !accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="font-medium text-gray-900 dark:text-white">
            Resume<span className="text-blue-600">Tailor</span>
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => logout().then(() => router.push("/login"))}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Log out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <MasterResumeControl />

        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">Applications</p>
          <button
            type="button"
            onClick={() => router.push("/applications/new")}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors min-h-[44px]"
          >
            <IconPlus size={16} /> New application
          </button>
        </div>

        {applications === null && <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>}

        {applications !== null && applications.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">No applications yet. Start by creating a new one.</p>
        )}

        {applications !== null && applications.length > 0 && (
          <div className="space-y-2">
            {applications.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => router.push(`/applications/${app.id}`)}
                className="w-full text-left bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between hover:border-blue-500 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {app.roleTitle} · {app.companyName}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-sm font-medium text-green-600 shrink-0 ml-3">{app.atsScore}/100</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
