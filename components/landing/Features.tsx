"use client";

import { IconGauge, IconSearch, IconWand, IconFileUpload, IconTemplate, IconArrowsExchange } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";

interface Feature {
  icon: Icon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: IconGauge,
    title: "ATS Score Simulation",
    description: "See how an applicant tracking system would score your resume before you ever apply.",
  },
  {
    icon: IconSearch,
    title: "Keyword Gap Analysis",
    description: "Every keyword the job description mentions that your resume doesn't, laid out clearly.",
  },
  {
    icon: IconWand,
    title: "One-Click Tailored Rewrite",
    description: "Turn suggestions into a rewritten resume in a single click, no starting from scratch.",
  },
  {
    icon: IconFileUpload,
    title: "Master Resume",
    description: "Upload once, reuse it for every application — no re-uploading for each new role.",
  },
  {
    icon: IconTemplate,
    title: "Template Library",
    description: "Download your tailored resume as a polished PDF or DOCX, styled to match your target role.",
  },
  {
    icon: IconArrowsExchange,
    title: "Before/After Comparison",
    description: "Your original score is never overwritten, so you can always see exactly what improved.",
  },
];

export function Features() {
  return (
    <section className="max-w-[1100px] mx-auto px-[clamp(24px,6vw,64px)] py-[clamp(56px,9vw,88px)]">
      <div className="text-center mb-[clamp(40px,6vw,56px)]">
        <h2 className="text-[clamp(26px,3.5vw,36px)] font-medium tracking-[-0.015em]">
          Everything you need to apply with confidence
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {features.map((feature) => {
          const FeatureIcon = feature.icon;
          return (
            <div
              key={feature.title}
              className="rounded-card border border-border-hairline bg-surface p-6 transition-all duration-150 hover:-translate-y-[3px] hover:shadow-[var(--card-shadow)]"
            >
              <div className="w-9 h-9 rounded-[10px] bg-accent-surface flex items-center justify-center mb-4">
                <FeatureIcon size={18} className="text-accent-surface-text" />
              </div>
              <h3 className="text-[15.5px] font-medium mb-[6px]">{feature.title}</h3>
              <p className="text-[13.5px] text-text-secondary leading-relaxed">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
