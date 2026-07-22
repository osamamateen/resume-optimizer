"use client";

import type { ReactNode } from "react";
import { ScoreMockup } from "@/components/landing/mockups/ScoreMockup";
import { KeywordsMockup } from "@/components/landing/mockups/KeywordsMockup";
import { RewriteMockup } from "@/components/landing/mockups/RewriteMockup";

interface SolutionRow {
  title: string;
  description: string;
  visual: ReactNode;
}

const rows: SolutionRow[] = [
  {
    title: "Score against the job description",
    description:
      "Your original resume is scored first, unmodified — so the before-and-after comparison always stays honest.",
    visual: <ScoreMockup />,
  },
  {
    title: "See what's missing",
    description: "ATS keyword gaps are surfaced explicitly, not buried inside a single opaque number.",
    visual: <KeywordsMockup />,
  },
  {
    title: "Get a tailored rewrite",
    description:
      "One click re-runs the optimization against your original resume, then download it as a PDF or DOCX in your chosen template.",
    visual: <RewriteMockup />,
  },
];

export function Solution() {
  return (
    <section className="max-w-[1100px] mx-auto px-[clamp(24px,6vw,64px)] py-[clamp(56px,9vw,88px)] flex flex-col gap-[clamp(48px,8vw,72px)]">
      {rows.map((row, i) => (
        <div
          key={row.title}
          className={`flex flex-col md:flex-row items-center gap-8 md:gap-14 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}
        >
          <div className="flex-1 rounded-card border border-border-hairline bg-surface shadow-[var(--card-shadow)] aspect-[4/3] w-full flex items-center justify-center overflow-hidden">
            {row.visual}
          </div>
          <div className="flex-1 flex flex-col gap-3">
            <h3 className="text-[24px] font-medium tracking-[-0.015em]">{row.title}</h3>
            <p className="text-[15px] text-text-secondary leading-relaxed max-w-[440px]">{row.description}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
