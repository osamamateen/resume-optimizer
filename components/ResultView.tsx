"use client";

import { useState } from "react";
import { IconArrowLeft, IconDownload } from "@tabler/icons-react";
import type { ResumeData } from "@/types/resume.types";
import { TemplateSelector } from "@/components/resume/TemplateSelector";
import { authFetch } from "@/lib/auth/authFetch";

interface ResultViewProps {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: { headline: string; bullets: string[] };
  resumeData: ResumeData;
  previousAtsScore: number;
  previousMissingKeywords: string[];
  onRestart: () => void;
}

export function ResultView({
  atsScore,
  matchedKeywords,
  missingKeywords,
  summaryOfChanges,
  resumeData,
  previousAtsScore,
  previousMissingKeywords,
  onRestart,
}: ResultViewProps) {
  const [templateId, setTemplateId] = useState("modern");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const keywordsAdded = matchedKeywords.filter((kw) => previousMissingKeywords.includes(kw));

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await authFetch("/api/resume/render", {
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
      {/* ATS score comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">ATS alignment before</p>
          <p className="text-2xl sm:text-3xl font-medium text-gray-500 dark:text-gray-400">
            {previousAtsScore}<span className="text-sm text-gray-400 ml-1">/100</span>
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">ATS alignment after</p>
          <p className="text-2xl sm:text-3xl font-medium text-green-600">
            {atsScore}<span className="text-sm text-gray-400 ml-1">/100</span>
          </p>
        </div>
      </div>

      {/* Keywords */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Keywords added</p>
          <div className="flex flex-wrap gap-1.5">
            {keywordsAdded.map((kw) => (
              <span key={kw} className="bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Still missing</p>
          <div className="flex flex-wrap gap-1.5">
            {missingKeywords.map((kw) => (
              <span key={kw} className="bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 text-xs px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* What changed */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">What changed</p>
        <p className="text-sm font-medium text-gray-800 dark:text-white leading-relaxed">{summaryOfChanges.headline}</p>
        <ul className="space-y-1.5">
          {summaryOfChanges.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 shrink-0" />
              <span className="leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      <hr className="border-gray-100 dark:border-gray-800" />

      {/* Template selector */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Choose a template</p>
        <TemplateSelector selectedTemplateId={templateId} onSelect={setTemplateId} />
      </div>

      {/* Action row */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          {downloading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generating PDF...
            </>
          ) : (
            <>
              <IconDownload size={16} /> Download PDF
            </>
          )}
        </button>
        {downloadError && (
          <p className="text-sm text-red-600">{downloadError}</p>
        )}
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
        >
          <IconArrowLeft size={16} /> Go Back
        </button>
      </div>
    </div>
  );
}
