"use client";

interface ApplicationDetailsStepProps {
  companyName: string;
  roleTitle: string;
  onCompanyNameChange: (value: string) => void;
  onRoleTitleChange: (value: string) => void;
  onNext: () => void;
}

export function ApplicationDetailsStep({
  companyName,
  roleTitle,
  onCompanyNameChange,
  onRoleTitleChange,
  onNext,
}: ApplicationDetailsStepProps) {
  const canProceed = companyName.trim().length > 0 && roleTitle.trim().length > 0;

  return (
    <div className="max-w-[440px] mx-auto">
      <div className="text-[11px] tracking-wide text-accent uppercase mb-[6px]">Application details</div>
      <div className="text-2xl font-medium mb-6 tracking-[-0.015em] text-text-primary">Where are you applying?</div>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="companyName" className="block text-[12px] mb-[5px] text-text-secondary">
            Company
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Acme Corp"
            className="w-full min-h-[36px] px-3 py-2 text-[15px] text-text-primary bg-surface border border-border-hairline rounded-lg outline-none"
          />
        </div>
        <div>
          <label htmlFor="roleTitle" className="block text-[12px] mb-[5px] text-text-secondary">
            Role title
          </label>
          <input
            id="roleTitle"
            type="text"
            value={roleTitle}
            onChange={(e) => onRoleTitleChange(e.target.value)}
            placeholder="Senior Backend Engineer"
            className="w-full min-h-[36px] px-3 py-2 text-[15px] text-text-primary bg-surface border border-border-hairline rounded-lg outline-none"
          />
        </div>
        <div className="flex justify-end mt-1.5">
          <button
            type="button"
            disabled={!canProceed}
            onClick={onNext}
            className="flex items-center gap-[7px] px-[18px] py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            Next
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 6.5h9M7 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
