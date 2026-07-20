"use client";

import { useCountUp } from "@/lib/hooks/useCountUp";

interface ScoringViewProps {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: { headline: string; bullets: string[] };
  onOptimize: () => void;
  optimizing: boolean;
  error: string | null;
}

const CIRCUMFERENCE = 326.7;

export function ScoringView({
  atsScore,
  matchedKeywords,
  missingKeywords,
  suggestions,
  onOptimize,
  optimizing,
  error,
}: ScoringViewProps) {
  const displayedScore = useCountUp(0, atsScore);
  const gaugeOffset = CIRCUMFERENCE * (1 - displayedScore / 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 bg-surface rounded-card p-6 flex-wrap">
        <div className="relative w-[112px] h-[112px] shrink-0">
          <svg width="112" height="112" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" className="stroke-chip-neutral-bg" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              className="stroke-accent"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={gaugeOffset}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[27px] font-medium text-text-primary">{displayedScore}</div>
            <div className="text-[11px] text-text-secondary">/ 100</div>
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="text-[11px] tracking-wide text-accent uppercase mb-[5px]">ATS alignment</div>
          <div className="text-sm text-text-secondary leading-relaxed">{suggestions.headline}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-surface rounded-lg p-4">
          <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">Matched keywords</div>
          <div className="flex flex-wrap gap-[6px]">
            {matchedKeywords.map((kw) => (
              <span key={kw} className="text-[11px] px-[10px] py-[3px] rounded-md bg-accent-surface text-accent-surface-text">
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">Missing keywords</div>
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
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">Suggested improvements</div>
        <div className="flex flex-col gap-[9px]">
          {suggestions.bullets.map((bullet, i) => (
            <div key={i} className="flex gap-[9px] text-[13.5px] text-text-secondary leading-relaxed">
              <span className="text-accent shrink-0">—</span>
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onOptimize}
        disabled={optimizing}
        className="w-full flex items-center justify-center gap-[9px] px-4 py-3 border border-accent rounded-lg bg-transparent text-accent text-[15px] font-medium disabled:opacity-50 cursor-pointer"
      >
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
          <path d="M7 1l1.2 3.8L12 6l-3.8 1.2L7 11l-1.2-3.8L2 6l3.8-1.2L7 1z" stroke="currentColor" strokeWidth="1" />
        </svg>
        {optimizing ? "Optimizing..." : "Optimize this resume"}
      </button>
    </div>
  );
}
