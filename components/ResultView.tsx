"use client";

import { useState } from "react";
import type { ResumeData } from "@/types/resume.types";
import { TemplateSelector } from "@/components/resume/TemplateSelector";

interface ResultViewProps {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: string;
  resumeData: ResumeData;
  onRestart: () => void;
}

export function ResultView({
  atsScore,
  matchedKeywords,
  missingKeywords,
  summaryOfChanges,
  resumeData,
  onRestart,
}: ResultViewProps) {
  const [templateId, setTemplateId] = useState("modern");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/resume/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData, templateId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">Estimated ATS match score (AI estimate, not a certified metric)</p>
        <p className="text-3xl font-bold">{atsScore}/100</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="font-medium text-sm mb-1">Matched keywords</p>
          <div className="flex flex-wrap gap-1">
            {matchedKeywords.map((keyword) => (
              <span key={keyword} className="rounded bg-green-100 text-green-800 px-2 py-0.5 text-xs">
                {keyword}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="font-medium text-sm mb-1">Missing keywords</p>
          <div className="flex flex-wrap gap-1">
            {missingKeywords.map((keyword) => (
              <span key={keyword} className="rounded bg-red-100 text-red-800 px-2 py-0.5 text-xs">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="font-medium text-sm mb-1">Summary of changes</p>
        <p className="text-sm text-gray-700">{summaryOfChanges}</p>
      </div>

      <div>
        <p className="font-medium text-sm mb-3">Choose a template</p>
        <TemplateSelector selectedTemplateId={templateId} onSelect={setTemplateId} />
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50 flex items-center gap-2"
        >
          {downloading && (
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          )}
          {downloading ? "Generating PDF..." : "Download PDF"}
        </button>
        {downloadError && (
          <p className="text-sm text-red-600">{downloadError}</p>
        )}
      </div>

      <button type="button" onClick={onRestart} className="rounded border px-4 py-2">
        Start over
      </button>
    </div>
  );
}
