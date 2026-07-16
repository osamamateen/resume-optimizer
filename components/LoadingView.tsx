"use client";

import { useEffect, useState } from "react";
import { IconSparkles } from "@tabler/icons-react";

const MESSAGES = [
  "Analyzing job description...",
  "Identifying key requirements...",
  "Scanning your resume...",
  "Matching skills and keywords...",
  "Tailoring your experience sections...",
  "Scoring ATS compatibility...",
  "Finalizing optimizations...",
];

const BASE_RATE = 1.2;
const MAX_PROGRESS = 88;

export function LoadingView() {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= MAX_PROGRESS) return prev;
        const increment = BASE_RATE * (1 - prev / MAX_PROGRESS);
        return Math.min(prev + increment, MAX_PROGRESS);
      });
    }, 150);

    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="flex flex-col items-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
          <IconSparkles size={20} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Optimizing your resume</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500">This usually takes 10–15 seconds</p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-8 text-right">
            {Math.round(progress)}%
          </span>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center">{MESSAGES[messageIndex]}</p>
      </div>
    </div>
  );
}
