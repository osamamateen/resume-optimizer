"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@tabler/icons-react";
import { ApplicationDetailsStep } from "@/components/ApplicationDetailsStep";
import { ResumeSourceStep, type ResumeSource } from "@/components/ResumeSourceStep";
import { JobDescriptionStep } from "@/components/JobDescriptionStep";
import { LoadingView } from "@/components/LoadingView";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { useMasterResume } from "@/lib/hooks/useMasterResume";
import { ThemeToggle } from "@/components/ThemeToggle";

type Step = "details" | "resume" | "jobDescription";

const STEPS: { key: Step; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "resume", label: "Resume" },
  { key: "jobDescription", label: "Job description" },
];

function stepIndex(step: Step): number {
  return STEPS.findIndex((s) => s.key === step);
}

function Stepper({ currentStep }: { currentStep: Step }) {
  const current = stepIndex(currentStep);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-gray-200 dark:bg-gray-700" />}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-blue-600 text-white"
                    : "border border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600"
                }`}
              >
                {done ? <IconCheck size={10} /> : <span className="text-[10px] font-medium">{i + 1}</span>}
              </div>
              <span
                className={`hidden md:inline text-sm whitespace-nowrap ${
                  active ? "text-blue-600 font-medium" : "text-gray-400 dark:text-gray-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface OptimizeResponse {
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
        throw new Error(typeof body.error === "string" ? body.error : "Optimization failed");
      }
      const data: OptimizeResponse = await res.json();
      router.push(`/applications/${data.applicationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (!ready || !accessToken || !masterResumeLoaded) {
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
            <Stepper currentStep={step} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {error && (
          <p className="mb-6 rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {loading && <LoadingView />}

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
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}
