"use client";

import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { UploadStep } from "@/components/UploadStep";
import { JobDescriptionStep } from "@/components/JobDescriptionStep";
import { ResultView } from "@/components/ResultView";
import { LoadingView } from "@/components/LoadingView";
import type { ResumeData } from "@/types/resume.types";

type Step = "upload" | "jobDescription" | "result";

interface OptimizeResponse {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: string;
  resumeData: ResumeData;
}

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "jobDescription", label: "Job description" },
  { key: "result", label: "Results" },
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
            {i > 0 && <div className="w-6 h-px bg-gray-200" />}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-blue-600 text-white"
                    : "border border-gray-300 text-gray-400"
                }`}
              >
                {done ? (
                  <IconCheck size={10} />
                ) : (
                  <span className="text-[10px] font-medium">{i + 1}</span>
                )}
              </div>
              <span
                className={`text-sm whitespace-nowrap ${
                  active ? "text-blue-600 font-medium" : "text-gray-400"
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

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OptimizeResponse | null>(null);

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("jobDescription", jobDescription);

      const res = await fetch("/api/optimize", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Optimization failed");
      }
      const data: OptimizeResponse = await res.json();
      setResult(data);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleRestart() {
    setStep("upload");
    setFile(null);
    setJobDescription("");
    setResult(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-medium text-gray-900">
            Resume<span className="text-blue-600">Tailor</span>
          </span>
          <Stepper currentStep={step} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {error && (
          <p className="mb-6 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {step === "upload" && (
          <UploadStep
            file={file}
            onFileChange={setFile}
            onNext={() => setStep("jobDescription")}
          />
        )}
        {loading && <LoadingView />}
        {!loading && step === "jobDescription" && (
          <JobDescriptionStep
            jobDescription={jobDescription}
            onChange={setJobDescription}
            onBack={() => setStep("upload")}
            onSubmit={handleSubmit}
            loading={loading}
          />
        )}
        {step === "result" && result && (
          <ResultView
            atsScore={result.atsScore}
            matchedKeywords={result.matchedKeywords}
            missingKeywords={result.missingKeywords}
            summaryOfChanges={result.summaryOfChanges}
            resumeData={result.resumeData}
            onRestart={handleRestart}
          />
        )}
      </main>
    </div>
  );
}
