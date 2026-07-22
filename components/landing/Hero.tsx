"use client";

import Link from "next/link";
import { HeroMockup } from "@/components/landing/mockups/HeroMockup";

export function Hero() {
  return (
    <section className="max-w-[1100px] mx-auto px-[clamp(24px,6vw,64px)] pt-[clamp(56px,10vw,96px)] pb-[clamp(48px,8vw,80px)]">
      <div className="flex flex-col items-center text-center gap-6">
        <span className="inline-flex items-center px-3 py-[6px] rounded-full bg-accent-surface text-accent-surface-text text-[12.5px] font-medium tracking-wide">
          AI-powered resume tailoring
        </span>
        <h1 className="text-[clamp(32px,5vw,52px)] font-medium tracking-[-0.02em] leading-[1.1] max-w-[720px]">
          Tailor your resume to every job, not just one
        </h1>
        <p className="text-[16px] text-text-secondary max-w-[560px] leading-relaxed">
          {"Score your resume against a job description, see exactly what's missing, and get a tailored rewrite — before you ever hit submit."}
        </p>
        <div className="flex items-center gap-4 flex-wrap justify-center mt-2">
          <Link href="/signup" className="px-6 py-[13px] rounded-lg bg-accent text-bg text-[14.5px] font-medium">
            Get started free
          </Link>
          <Link href="/login" className="text-[14.5px] text-text-secondary">
            Log in →
          </Link>
        </div>
      </div>

      <div className="mt-[clamp(48px,8vw,72px)] rounded-card border border-border-hairline bg-surface shadow-[var(--card-shadow)] aspect-auto sm:aspect-video max-w-[860px] mx-auto overflow-hidden">
        <HeroMockup />
      </div>
    </section>
  );
}
