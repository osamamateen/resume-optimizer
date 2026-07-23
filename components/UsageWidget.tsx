"use client";

import { useUsage } from "@/lib/hooks/useUsage";

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const maxedOut = used >= limit;
  return (
    <div>
      <div className="flex items-center justify-between mb-[6px]">
        <span className="text-[10.5px] tracking-wide text-text-secondary uppercase">{label}</span>
        <span className="text-[12px] text-text-secondary">
          {used}/{limit}
        </span>
      </div>
      <div className="h-[6px] rounded-full bg-chip-neutral-bg overflow-hidden">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      {maxedOut && <div className="text-[11.5px] text-text-secondary mt-[6px]">Resets at midnight UTC.</div>}
    </div>
  );
}

export function UsageWidget() {
  const { usage, loaded } = useUsage(true);

  if (!loaded || !usage) return null;

  return (
    <div className="bg-surface rounded-lg p-4 flex flex-col gap-4">
      <UsageBar label="Scores today" used={usage.score.used} limit={usage.score.limit} />
      <UsageBar label="Optimizes today" used={usage.optimize.used} limit={usage.optimize.limit} />
    </div>
  );
}
