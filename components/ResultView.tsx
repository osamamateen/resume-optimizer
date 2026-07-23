"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ResumeData } from "@/types/resume.types";
import { TemplateSelector } from "@/components/resume/TemplateSelector";
import { authFetch } from "@/lib/auth/authFetch";
import { useCountUp } from "@/lib/hooks/useCountUp";

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

const CIRCUMFERENCE = 276.5;

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
  const params = useParams<{ id: string }>();
  const [templateId, setTemplateId] = useState("modern");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const normalize = (kw: string) => kw.trim().toLowerCase();
  const previousMissingNormalized = previousMissingKeywords.map(normalize);
  const keywordsAdded = matchedKeywords.filter((kw) => previousMissingNormalized.includes(normalize(kw)));

  const displayedAfter = useCountUp(previousAtsScore, atsScore);
  const beforeOffset = CIRCUMFERENCE * (1 - previousAtsScore / 100);
  const afterOffset = CIRCUMFERENCE * (1 - displayedAfter / 100);

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
      <div className="flex items-center justify-start gap-[26px] bg-surface rounded-card p-6 flex-wrap">
        <div className="text-center">
          <div className="relative w-24 h-24">
            <svg width="96" height="96" viewBox="0 0 104 104">
              <circle cx="52" cy="52" r="44" fill="none" className="stroke-chip-neutral-bg" strokeWidth="7" />
              <circle
                cx="52"
                cy="52"
                r="44"
                fill="none"
                stroke="#75798c"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={beforeOffset}
                transform="rotate(-90 52 52)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[21px] font-medium text-text-secondary">{previousAtsScore}</div>
            </div>
          </div>
          <div className="text-[11px] tracking-wide text-text-secondary uppercase mt-2">Before</div>
        </div>

        <svg width="20" height="20" viewBox="0 0 22 22" fill="none" className="shrink-0">
          <path d="M4 11h14M13 5l6 6-6 6" className="stroke-text-secondary" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div className="text-center">
          <div className="relative w-24 h-24">
            <svg width="96" height="96" viewBox="0 0 104 104">
              <circle cx="52" cy="52" r="44" fill="none" className="stroke-chip-neutral-bg" strokeWidth="7" />
              <circle
                cx="52"
                cy="52"
                r="44"
                fill="none"
                className="stroke-accent"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={afterOffset}
                transform="rotate(-90 52 52)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[21px] font-medium text-text-primary">{displayedAfter}</div>
            </div>
          </div>
          <div className="text-[11px] tracking-wide text-accent uppercase mt-2">After</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-surface rounded-lg p-4">
          <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">Keywords added</div>
          <div className="flex flex-wrap gap-[6px]">
            {keywordsAdded.map((kw) => (
              <span key={kw} className="text-[11px] px-[10px] py-[3px] rounded-md bg-accent-surface text-accent-surface-text">
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">Still missing</div>
          <div className="flex flex-wrap gap-[6px]">
            {missingKeywords.map((kw) => (
              <span key={kw} className="text-[11px] px-[10px] py-[3px] rounded-md bg-chip-neutral-bg text-chip-neutral-text">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg p-[19px]">
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">What changed</div>
        <div className="flex flex-col gap-[9px]">
          {summaryOfChanges.bullets.map((bullet, i) => (
            <div key={i} className="flex gap-[9px] text-[13.5px] text-text-secondary leading-relaxed">
              <svg width="13" height="13" viewBox="0 0 11 11" fill="none" className="shrink-0 mt-[3px] stroke-accent">
                <path d="M2 5.5l2.3 2.3L9 3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Choose a template</div>
        <TemplateSelector selectedTemplateId={templateId} onSelect={setTemplateId} />
      </div>

      <div className="flex flex-col gap-[9px]">
        <Link
          href={`/applications/${params.id}/edit`}
          className="w-full flex items-center justify-center gap-[9px] px-4 py-3 border border-border-hairline rounded-lg bg-transparent text-text-primary text-[15px] font-medium cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M2 13h2.2l7-7-2.2-2.2-7 7V13zM10 2.5L12.5 5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Edit resume
        </Link>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-[9px] px-4 py-3 border border-accent rounded-lg bg-transparent text-accent text-[15px] font-medium disabled:opacity-50 cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 1v8M4 6l3.5 3.5L11 6M2.5 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {downloading ? "Generating PDF..." : "Download PDF"}
        </button>
        {downloadError && <p className="text-sm text-red-600 dark:text-red-400">{downloadError}</p>}
        <button
          type="button"
          onClick={onRestart}
          className="px-4 py-[11px] border border-border-hairline rounded-lg bg-transparent text-text-primary text-sm cursor-pointer"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
