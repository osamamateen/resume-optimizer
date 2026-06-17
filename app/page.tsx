"use client";

import { useState } from "react";
import { UploadStep } from "@/components/UploadStep";
import { JobDescriptionStep } from "@/components/JobDescriptionStep";
import { ResultView } from "@/components/ResultView";
import type { ResumeData } from "@/types/resume.types";

type Step = "upload" | "jobDescription" | "result";

interface OptimizeResponse {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: string;
  resumeData: ResumeData;
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
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold mb-6">Resume Optimizer</h1>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {step === "upload" && (
        <UploadStep
          file={file}
          onFileChange={setFile}
          onNext={() => setStep("jobDescription")}
        />
      )}
      {step === "jobDescription" && (
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
  );
}
