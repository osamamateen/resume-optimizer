"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { AppHeader } from "@/components/AppHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import type { ResumeData } from "@/types/resume.types";

interface ApplicationDetail {
  id: string;
  resumeData: ResumeData | null;
}

export default function ResumeEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { accessToken, ready } = useAuth();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        const data: ApplicationDetail = await res.json();
        if (data.resumeData === null) {
          router.push(`/applications/${params.id}`);
          return;
        }
        setApplication(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load application"));
  }, [accessToken, params.id, router]);

  async function handleSave(resumeData: ResumeData) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch(`/api/applications/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Save failed");
      }
      router.push(`/applications/${params.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
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

        {application && application.resumeData && (
          <>
            <div className="text-2xl font-medium tracking-[-0.015em] text-text-primary">Edit resume</div>
            <ResumeEditor
              initialData={application.resumeData}
              onSave={handleSave}
              onCancel={() => router.push(`/applications/${params.id}`)}
              saving={saving}
              error={saveError}
            />
          </>
        )}
      </main>
    </div>
  );
}
