"use client";

import { useEffect, useState } from "react";
import { IconSparkles } from "@tabler/icons-react";

const SCORING_MESSAGES = [
  "Reading your resume...",
  "Parsing sections...",
  "Comparing against the job description...",
  "Identifying keyword gaps...",
  "Calculating ATS alignment...",
];

const OPTIMIZING_MESSAGES = [
  "Reviewing suggested improvements...",
  "Rewriting bullet points...",
  "Weaving in missing keywords...",
  "Polishing your summary...",
  "Finalizing your optimized resume...",
];

const BASE_RATE = 1.2;
const MAX_PROGRESS = 88;

interface LoadingViewProps {
  variant: "scoring" | "optimizing";
}

export function LoadingView({ variant }: LoadingViewProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = variant === "scoring" ? SCORING_MESSAGES : OPTIMIZING_MESSAGES;

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= MAX_PROGRESS) return prev;
        const increment = BASE_RATE * (1 - prev / MAX_PROGRESS);
        return Math.min(prev + increment, MAX_PROGRESS);
      });
    }, 150);

    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [messages]);

  const title = variant === "scoring" ? "Scoring your resume" : "Optimizing your resume";
  const subtitle = variant === "scoring" ? "This usually takes 10–15 seconds." : "Rewriting content to match the role.";

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="flex flex-col items-center space-y-2">
        {variant === "scoring" ? (
          <div className="w-12 h-12 rounded-full border-[2.5px] border-border-hairline border-t-accent animate-spin" />
        ) : (
          <div className="w-12 h-12 rounded-xl border border-accent-surface flex items-center justify-center">
            <IconSparkles size={20} className="text-accent animate-pulse" />
          </div>
        )}
        <h2 className="text-lg font-medium text-text-primary mt-2">{title}</h2>
        <p className="text-sm text-text-secondary">{subtitle}</p>
      </div>

      <div className="w-full max-w-[380px] mx-auto space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-chip-neutral-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-text-secondary tabular-nums w-8 text-right">
            {Math.round(progress)}%
          </span>
        </div>

        <p className="text-sm text-text-secondary italic text-center">{messages[messageIndex]}</p>
      </div>
    </div>
  );
}
