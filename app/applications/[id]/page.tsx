"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ResultView } from "@/components/ResultView";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ResumeData } from "@/types/resume.types";

interface ApplicationDetail {
  id: string;
  companyName: string;
  roleTitle: string;
  jobDescription: string;
  resumeData: ResumeData;
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: { headline: string; bullets: string[] };
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { accessToken, ready } = useAuth();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (ready && !accessToken) {
      router.push("/login");
    }
  }, [ready, accessToken, router]);

  useEffect(() => {
    if (!accessToken) return;
    authFetch(`/api/applications/${params.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Application not found");
        setApplication(await res.json());
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load application"));
  }, [accessToken, params.id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await authFetch(`/api/applications/${params.id}`, { method: "DELETE" });
      router.push("/");
    } finally {
      setDeleting(false);
    }
  }

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
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {!application && !error && <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>}

        {application && (
          <>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {application.companyName}
              </p>
              <h1 className="text-lg font-medium text-gray-900 dark:text-white">{application.roleTitle}</h1>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete this application"}
              </button>
            </div>

            <ResultView
              atsScore={application.atsScore}
              matchedKeywords={application.matchedKeywords}
              missingKeywords={application.missingKeywords}
              summaryOfChanges={application.summaryOfChanges}
              resumeData={application.resumeData}
              onRestart={() => router.push("/")}
            />
          </>
        )}
      </main>
    </div>
  );
}
