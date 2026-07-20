"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface AppHeaderProps {
  rightSlot?: ReactNode;
}

export function AppHeader({ rightSlot }: AppHeaderProps) {
  return (
    <div className="flex items-center gap-[17px] px-[clamp(24px,6vw,64px)] py-2">
      <Link href="/" className="text-[18px] font-medium tracking-[-0.015em] mr-auto">
        Resume<span className="text-accent">Tailor</span>
      </Link>
      {rightSlot}
    </div>
  );
}
