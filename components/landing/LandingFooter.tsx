"use client";

import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border-hairline">
      <div className="max-w-[1100px] mx-auto px-[clamp(24px,6vw,64px)] py-10 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex flex-col items-center md:items-start gap-1">
          <span className="text-[15px] font-medium tracking-[-0.015em]">
            Resume<span className="text-accent">Tailor</span>
          </span>
          <span className="text-[12.5px] text-text-secondary">AI-powered resume tailoring for every application.</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-[13.5px] text-text-secondary">
            Log in
          </Link>
          <Link href="/signup" className="text-[13.5px] text-accent font-medium">
            Sign up
          </Link>
        </div>
      </div>
      <div className="text-center text-[12px] text-text-secondary pb-6">
        © {new Date().getFullYear()} ResumeTailor. All rights reserved.
      </div>
    </footer>
  );
}
