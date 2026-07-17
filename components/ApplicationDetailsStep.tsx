"use client";

import { IconArrowRight } from "@tabler/icons-react";

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
    <div className="space-y-4">
      <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Application details
      </p>
      <div className="space-y-3">
        <div>
          <label htmlFor="companyName" className="text-sm text-gray-700 dark:text-gray-300">
            Company
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Acme Corp"
            className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="roleTitle" className="text-sm text-gray-700 dark:text-gray-300">
            Role title
          </label>
          <input
            id="roleTitle"
            type="text"
            value={roleTitle}
            onChange={(e) => onRoleTitleChange(e.target.value)}
            placeholder="Senior Backend Engineer"
            className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canProceed}
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          Next <IconArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
