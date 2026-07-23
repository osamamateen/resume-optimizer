"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ResultView } from "@/components/ResultView";
import { ScoringView } from "@/components/ScoringView";
import { LoadingView } from "@/components/LoadingView";
import { AppHeader } from "@/components/AppHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { useUsage } from "@/lib/hooks/useUsage";
import type { ResumeData } from "@/types/resume.types";

interface ApplicationDetail {
  id: string;
  companyName: string;
  roleTitle: string;
  jobDescription: string;
  resumeData: ResumeData | null;
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: { headline: string; bullets: string[] } | null;
  originalAtsScore: number;
  originalMatchedKeywords: string[];
  originalMissingKeywords: string[];
  suggestions: { headline: string; bullets: string[] };
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { accessToken, ready } = useAuth();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const { usage, reload: reloadUsage } = useUsage(!!accessToken);
  const optimizeLimitReached = usage !== null && usage.optimize.used >= usage.optimize.limit;

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

  async function handleOptimize() {
    setOptimizing(true);
    setOptimizeError(null);
    try {
      const res = await authFetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: params.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Optimization failed");
      }
      setApplication(await res.json());
      reloadUsage();
    } catch (err) {
      setOptimizeError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setOptimizing(false);
    }
  }

  if (!ready || !accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <AppHeader rightSlot={<ThemeToggle />} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {!application && !error && (
          <div className="space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-40 w-full mt-4" />
          </div>
        )}

        {application && optimizing && <LoadingView variant="optimizing" />}

        {application && !optimizing && (
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

            {application.resumeData === null ? (
              <ScoringView
                atsScore={application.atsScore}
                matchedKeywords={application.matchedKeywords}
                missingKeywords={application.missingKeywords}
                suggestions={application.suggestions}
                onOptimize={handleOptimize}
                optimizing={optimizing}
                error={optimizeError}
                limitReached={optimizeLimitReached}
              />
            ) : (
              <ResultView
                atsScore={application.atsScore}
                matchedKeywords={application.matchedKeywords}
                missingKeywords={application.missingKeywords}
                summaryOfChanges={application.summaryOfChanges!}
                resumeData={application.resumeData}
                previousAtsScore={application.originalAtsScore}
                previousMissingKeywords={application.originalMissingKeywords}
                onRestart={() => router.push("/")}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
