"use client";

interface JobDescriptionStepProps {
  jobDescription: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  limitReached?: boolean;
}

export function JobDescriptionStep({
  jobDescription,
  onChange,
  onBack,
  onSubmit,
  limitReached = false,
}: JobDescriptionStepProps) {
  return (
    <div className="max-w-[600px] mx-auto">
      <div className="text-[11px] tracking-wide text-accent uppercase mb-[6px]">Job description</div>
      <div className="text-2xl font-medium mb-2 tracking-[-0.015em] text-text-primary">Paste the job description</div>
      <div className="text-[13.5px] text-text-secondary mb-[18px]">
        The more detail you give us, the sharper the scoring.
      </div>
      <textarea
        placeholder="Paste the job description here — role, responsibilities, requirements..."
        value={jobDescription}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        className="w-full min-h-[90px] px-[14px] py-3 text-text-primary bg-surface border border-border-hairline rounded-lg outline-none resize-y text-[14.5px] leading-[1.55]"
      />
      {limitReached && (
        <p className="mt-[14px] text-[13px] text-text-secondary">
          You&apos;ve used all 3 scores for today. Resets at midnight UTC.
        </p>
      )}
      <div className="flex justify-between mt-[18px]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-[7px] px-4 py-[9px] border border-border-hairline rounded-lg bg-transparent text-text-primary text-sm cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5H2M6 2.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <button
          type="button"
          disabled={!jobDescription.trim() || limitReached}
          onClick={onSubmit}
          className="flex items-center gap-2 px-[18px] py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1l1.2 3.8L12 6l-3.8 1.2L7 11l-1.2-3.8L2 6l3.8-1.2L7 1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
          Score my resume
        </button>
      </div>
    </div>
  );
}
