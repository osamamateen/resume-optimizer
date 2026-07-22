"use client";

const CIRCUMFERENCE = 326.7;
const SCORE = 74;
const OFFSET = CIRCUMFERENCE * (1 - SCORE / 100);

export function ScoreMockup() {
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="relative w-[104px] h-[104px]">
        <svg width="104" height="104" viewBox="0 0 120 120">
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
            strokeDashoffset={OFFSET}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[24px] font-medium text-text-primary">{SCORE}</div>
          <div className="text-[10px] text-text-secondary">/ 100</div>
        </div>
      </div>
      <div className="text-center max-w-[220px]">
        <div className="text-[10px] tracking-wide text-accent uppercase mb-1">ATS alignment</div>
        <div className="text-[12.5px] text-text-secondary leading-relaxed">Strong match — a few keyword gaps remain.</div>
      </div>
    </div>
  );
}
