"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconChevronRight, IconFileText } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MasterResumeControl } from "@/components/MasterResumeControl";
import { AppHeader } from "@/components/AppHeader";

interface ApplicationSummary {
  id: string;
  companyName: string;
  roleTitle: string;
  atsScore: number;
  createdAt: string;
  optimized: boolean;
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

  const apps = applications ?? [];
  const total = apps.length;
  const avgScore = total > 0 ? Math.round(apps.reduce((sum, a) => sum + a.atsScore, 0) / total) : 0;
  const optimizedCount = apps.filter((a) => a.optimized).length;

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <AppHeader
        rightSlot={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => logout().then(() => router.push("/login"))}
              className="border-none bg-transparent text-text-secondary text-[13.5px] cursor-pointer"
            >
              Log out
            </button>
            <ThemeToggle />
          </div>
        }
      />

      <main className="max-w-[760px] px-[clamp(24px,6vw,64px)] pt-7 pb-[72px]">
        <div className="flex items-baseline justify-between flex-wrap gap-[14px] mb-6">
          <div>
            <div className="text-[26px] font-medium tracking-[-0.015em]">Your applications</div>
            <div className="text-[13.5px] text-text-secondary mt-[3px]">
              Track ATS alignment across every role you apply to.
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/applications/new")}
            className="flex items-center gap-[7px] px-4 py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <IconPlus size={14} /> New application
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300 mb-6">
            {error}
          </p>
        )}

        <div className="mb-6">
          <MasterResumeControl />
        </div>

        {applications === null && <p className="text-sm text-text-secondary">Loading...</p>}

        {applications !== null && total > 0 && (
          <div className="grid gap-[11px] mb-6 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            <div className="bg-surface rounded-lg px-4 py-[14px]">
              <div className="text-[10.5px] tracking-wide text-text-secondary uppercase">Applications</div>
              <div className="text-2xl font-medium mt-1">{total}</div>
            </div>
            <div className="bg-surface rounded-lg px-4 py-[14px]">
              <div className="text-[10.5px] tracking-wide text-text-secondary uppercase">Average score</div>
              <div className="text-2xl font-medium mt-1">
                {avgScore}
                <span className="text-[13px] text-text-secondary">/100</span>
              </div>
            </div>
            <div className="bg-surface rounded-lg px-4 py-[14px]">
              <div className="text-[10.5px] tracking-wide text-text-secondary uppercase">Optimized</div>
              <div className="text-2xl font-medium mt-1">
                {optimizedCount}
                <span className="text-[13px] text-text-secondary"> / {total}</span>
              </div>
            </div>
          </div>
        )}

        {applications !== null && total > 0 && (
          <div className="flex flex-col gap-[9px]">
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => router.push(`/applications/${app.id}`)}
                className="w-full text-left bg-surface rounded-lg px-[18px] py-[15px] flex items-center justify-between gap-4 flex-wrap cursor-pointer"
              >
                <div className="flex flex-col gap-[5px] min-w-0">
                  <div className="flex items-center gap-[9px] flex-wrap">
                    <span className="text-[15px] font-medium">{app.roleTitle}</span>
                    <span className="text-[13px] text-text-secondary">· {app.companyName}</span>
                    <span
                      className={`text-[10.5px] tracking-wide uppercase px-[10px] py-[3px] rounded-md ${
                        app.optimized ? "bg-accent-surface text-accent-surface-text" : "bg-chip-neutral-bg text-chip-neutral-text"
                      }`}
                    >
                      {app.optimized ? "Optimized" : "Scored"}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-text-secondary">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-[10px] shrink-0">
                  <div className="text-[18px] font-medium text-text-primary">
                    {app.atsScore}
                    <span className="text-xs text-text-secondary">/100</span>
                  </div>
                  <IconChevronRight size={15} className="text-text-secondary" />
                </div>
              </button>
            ))}
          </div>
        )}

        {applications !== null && total === 0 && (
          <div className="text-left p-8 border border-border-hairline rounded-card bg-surface-alt">
            <div className="w-[38px] h-[38px] rounded-[10px] bg-surface flex items-center justify-center mb-[14px]">
              <IconFileText size={18} className="text-text-secondary" />
            </div>
            <div className="text-base font-medium mb-1">No applications yet</div>
            <div className="text-[13.5px] text-text-secondary mb-4">
              Start your first one and see how your resume scores.
            </div>
            <button
              type="button"
              onClick={() => router.push("/applications/new")}
              className="border border-accent bg-transparent text-accent px-4 py-2 rounded-lg text-[13.5px] font-medium cursor-pointer"
            >
              New application
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
