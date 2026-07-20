"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApplicationDetailsStep } from "@/components/ApplicationDetailsStep";
import { ResumeSourceStep, type ResumeSource } from "@/components/ResumeSourceStep";
import { JobDescriptionStep } from "@/components/JobDescriptionStep";
import { LoadingView } from "@/components/LoadingView";
import { AppHeader, type StepperItem } from "@/components/AppHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { useMasterResume } from "@/lib/hooks/useMasterResume";

type Step = "details" | "resume" | "jobDescription";

const STEPS: { key: Step; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "resume", label: "Resume" },
  { key: "jobDescription", label: "Job description" },
];

function stepIndex(step: Step): number {
  return STEPS.findIndex((s) => s.key === step);
}

interface ScoreResponse {
  applicationId: string;
}

export default function NewApplicationPage() {
  const router = useRouter();
  const { accessToken, ready } = useAuth();
  const { fileName: masterResumeFileName, loaded: masterResumeLoaded } = useMasterResume(!!accessToken);
  const [step, setStep] = useState<Step>("details");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [resumeSource, setResumeSource] = useState<ResumeSource | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !accessToken) {
      router.push("/login");
    }
  }, [ready, accessToken, router]);

  async function handleSubmit() {
    if (!resumeSource) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("companyName", companyName);
      formData.append("roleTitle", roleTitle);
      formData.append("jobDescription", jobDescription);
      formData.append("useMaster", String(resumeSource.useMaster));
      if (!resumeSource.useMaster) {
        formData.append("resume", resumeSource.file);
        formData.append("saveAsMaster", String(resumeSource.saveAsMaster));
      }

      const res = await authFetch("/api/score", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Scoring failed");
      }
      const data: ScoreResponse = await res.json();
      router.push(`/applications/${data.applicationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (!ready || !accessToken || !masterResumeLoaded) {
    return null;
  }

  const currentIndex = stepIndex(step);
  const stepperItems: StepperItem[] = STEPS.map((s, i) => ({
    label: s.label,
    state: i < currentIndex ? "done" : i === currentIndex ? "current" : "pending",
  }));

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <AppHeader stepperItems={loading ? undefined : stepperItems} rightSlot={<ThemeToggle />} />

      <main className="px-[clamp(24px,6vw,64px)] py-10">
        {error && (
          <p className="mb-6 max-w-[600px] mx-auto rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {loading && <LoadingView variant="scoring" />}

        {!loading && step === "details" && (
          <ApplicationDetailsStep
            companyName={companyName}
            roleTitle={roleTitle}
            onCompanyNameChange={setCompanyName}
            onRoleTitleChange={setRoleTitle}
            onNext={() => setStep("resume")}
          />
        )}
        {!loading && step === "resume" && (
          <ResumeSourceStep
            masterResumeFileName={masterResumeFileName}
            onBack={() => setStep("details")}
            onNext={(source) => {
              setResumeSource(source);
              setStep("jobDescription");
            }}
          />
        )}
        {!loading && step === "jobDescription" && (
          <JobDescriptionStep
            jobDescription={jobDescription}
            onChange={setJobDescription}
            onBack={() => setStep("resume")}
            onSubmit={handleSubmit}
          />
        )}
      </main>
    </div>
  );
}
