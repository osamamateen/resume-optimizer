"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-10 bg-bg border-b border-border-hairline">
      <div className="max-w-[1100px] mx-auto flex items-center gap-[17px] px-[clamp(24px,6vw,64px)] py-4">
        <Link href="/" className="text-[18px] font-medium tracking-[-0.015em] mr-auto">
          Resume<span className="text-accent">Tailor</span>
        </Link>
        <Link href="/login" className="text-[13.5px] text-text-secondary">
          Log in
        </Link>
        <Link
          href="/signup"
          className="px-4 py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium whitespace-nowrap"
        >
          Sign up
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
