"use client";

import { IconArrowLeft, IconSparkles } from "@tabler/icons-react";

interface JobDescriptionStepProps {
  jobDescription: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export function JobDescriptionStep({
  jobDescription,
  onChange,
  onBack,
  onSubmit,
  loading,
}: JobDescriptionStepProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">
          Job description
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
          Paste the full job description. The more detail the better.
        </p>
        <textarea
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 p-3 min-h-[120px] sm:min-h-[144px] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-y"
          placeholder="Paste the job description here — include role title, responsibilities, and requirements..."
          value={jobDescription}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
        >
          <IconArrowLeft size={16} /> Back
        </button>
        <button
          type="button"
          disabled={!jobDescription.trim() || loading}
          onClick={onSubmit}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Optimizing...
            </>
          ) : (
            <>
              <IconSparkles size={16} /> Optimize
            </>
          )}
        </button>
      </div>
    </div>
  );
}
