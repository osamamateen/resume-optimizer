"use client";

const CIRCUMFERENCE = 276.5;
const BEFORE = 68;
const AFTER = 91;
const BEFORE_OFFSET = CIRCUMFERENCE * (1 - BEFORE / 100);
const AFTER_OFFSET = CIRCUMFERENCE * (1 - AFTER / 100);

export function RewriteMockup() {
  return (
    <div className="flex flex-col items-center gap-4 p-5">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="relative w-[76px] h-[76px]">
            <svg width="76" height="76" viewBox="0 0 104 104">
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
                strokeDashoffset={BEFORE_OFFSET}
                transform="rotate(-90 52 52)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-text-secondary">
              {BEFORE}
            </div>
          </div>
          <div className="text-[9px] tracking-wide text-text-secondary uppercase mt-[6px]">Before</div>
        </div>

        <svg width="16" height="16" viewBox="0 0 22 22" fill="none" className="shrink-0">
          <path
            d="M4 11h14M13 5l6 6-6 6"
            className="stroke-text-secondary"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="text-center">
          <div className="relative w-[76px] h-[76px]">
            <svg width="76" height="76" viewBox="0 0 104 104">
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
                strokeDashoffset={AFTER_OFFSET}
                transform="rotate(-90 52 52)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-text-primary">
              {AFTER}
            </div>
          </div>
          <div className="text-[9px] tracking-wide text-accent uppercase mt-[6px]">After</div>
        </div>
      </div>

      <div className="flex items-center gap-[7px] px-4 py-[9px] border border-accent rounded-lg text-accent text-[12px] font-medium whitespace-nowrap">
        <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
          <path
            d="M7.5 1v8M4 6l3.5 3.5L11 6M2.5 12h10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Export PDF
      </div>
    </div>
  );
}
