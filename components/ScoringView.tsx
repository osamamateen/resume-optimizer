"use client";

interface ScoringViewProps {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: { headline: string; bullets: string[] };
  onOptimize: () => void;
  optimizing: boolean;
  error: string | null;
}

export function ScoringView({
  atsScore,
  matchedKeywords,
  missingKeywords,
  suggestions,
  onOptimize,
  optimizing,
  error,
}: ScoringViewProps) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4 w-fit">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">ATS alignment</p>
        <p className="text-2xl sm:text-3xl font-medium text-gray-800 dark:text-white">
          {atsScore}<span className="text-sm text-gray-400 ml-1">/100</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Matched keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {matchedKeywords.map((kw) => (
              <span key={kw} className="bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Missing keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {missingKeywords.map((kw) => (
              <span key={kw} className="bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 text-xs px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">Suggested improvements</p>
        <p className="text-sm font-medium text-gray-800 dark:text-white leading-relaxed">{suggestions.headline}</p>
        <ul className="space-y-1.5">
          {suggestions.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 shrink-0" />
              <span className="leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
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
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors min-h-[44px]"
      >
        {optimizing ? "Optimizing..." : "Optimize this resume"}
      </button>
    </div>
  );
}
