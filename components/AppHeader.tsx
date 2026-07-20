"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export interface StepperItem {
  label: string;
  state: "done" | "current" | "pending";
}

interface AppHeaderProps {
  rightSlot?: ReactNode;
  stepperItems?: StepperItem[];
}

export function AppHeader({ rightSlot, stepperItems }: AppHeaderProps) {
  return (
    <div className="flex items-center gap-[17px] px-[clamp(24px,6vw,64px)] py-2">
      <Link href="/" className="text-[18px] font-medium tracking-[-0.015em] mr-auto">
        Resume<span className="text-accent">Tailor</span>
      </Link>

      {stepperItems && stepperItems.length > 0 && (
        <div className="flex items-center gap-2">
          {stepperItems.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex items-center gap-[6px]">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${
                    step.state === "done"
                      ? "bg-accent text-bg"
                      : step.state === "current"
                        ? "bg-transparent text-accent border-[1.5px] border-accent"
                        : "bg-surface text-text-secondary"
                  }`}
                >
                  {step.state === "done" ? (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M2 5.5l2.3 2.3L9 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`hidden md:inline text-[12.5px] whitespace-nowrap ${
                    step.state === "current" ? "text-text-primary" : "text-text-secondary"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < stepperItems.length - 1 && <div className="w-[18px] h-px bg-border-hairline shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {rightSlot}
    </div>
  );
}
