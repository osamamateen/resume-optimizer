"use client";

export function HeroMockup() {
  return (
    <div className="max-w-[760px] mx-auto px-[clamp(24px,6vw,64px)] pt-7 pb-[72px]">
    <div className="w-full h-full flex flex-col gap-4 p-6">
      <div className="flex items-baseline justify-between">
        <div className="text-[15px] font-medium tracking-[-0.01em] text-text-primary">Your applications</div>
        <div className="text-[11px] px-3 py-[6px] border border-accent rounded-lg text-accent font-medium whitespace-nowrap">
          + New application
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg rounded-lg px-3 py-[10px]">
          <div className="text-[9px] tracking-wide text-text-secondary uppercase">Applications</div>
          <div className="text-[18px] font-medium mt-1 text-text-primary">4</div>
        </div>
        <div className="bg-bg rounded-lg px-3 py-[10px]">
          <div className="text-[9px] tracking-wide text-text-secondary uppercase">Average score</div>
          <div className="text-[18px] font-medium mt-1 text-text-primary">
            84<span className="text-[10px] text-text-secondary">/100</span>
          </div>
        </div>
        <div className="bg-bg rounded-lg px-3 py-[10px]">
          <div className="text-[9px] tracking-wide text-text-secondary uppercase">Optimized</div>
          <div className="text-[18px] font-medium mt-1 text-text-primary">
            2<span className="text-[10px] text-text-secondary"> / 4</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="bg-bg rounded-lg px-4 py-3 flex items-center justify-between flex-wrap gap-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-text-primary whitespace-nowrap">Senior Product Manager</span>
            <span className="text-[11px] text-text-secondary whitespace-nowrap">· Acme Inc</span>
            <span className="text-[9px] tracking-wide uppercase px-2 py-[2px] rounded-md bg-accent-surface text-accent-surface-text whitespace-nowrap">
              Optimized
            </span>
          </div>
          <div className="text-[15px] font-medium text-text-primary shrink-0">
            92<span className="text-[10px] text-text-secondary">/100</span>
          </div>
        </div>
        <div className="bg-bg rounded-lg px-4 py-3 flex items-center justify-between flex-wrap gap-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-text-primary whitespace-nowrap">Product Owner</span>
            <span className="text-[11px] text-text-secondary whitespace-nowrap">· Seeno Inc</span>
            <span className="text-[9px] tracking-wide uppercase px-2 py-[2px] rounded-md bg-accent-surface text-accent-surface-text whitespace-nowrap">
              Optimized
            </span>
          </div>
          <div className="text-[15px] font-medium text-text-primary shrink-0">
            95<span className="text-[10px] text-text-secondary">/100</span>
          </div>
        </div>
        <div className="bg-bg rounded-lg px-4 py-3 flex items-center justify-between flex-wrap gap-y-1 opacity-60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-text-primary whitespace-nowrap">Growth Lead</span>
            <span className="text-[11px] text-text-secondary whitespace-nowrap">· Northwind</span>
            <span className="text-[9px] tracking-wide uppercase px-2 py-[2px] rounded-md bg-chip-neutral-bg text-chip-neutral-text whitespace-nowrap">
              Scored
            </span>
          </div>
          <div className="text-[15px] font-medium text-text-primary shrink-0">
            78<span className="text-[10px] text-text-secondary">/100</span>
          </div>
        </div>
        <div className="bg-bg rounded-lg px-4 py-3 flex items-center justify-between flex-wrap gap-y-1 opacity-60">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-text-primary whitespace-nowrap">Product Engineer</span>
            <span className="text-[11px] text-text-secondary whitespace-nowrap">· Hooli</span>
            <span className="text-[9px] tracking-wide uppercase px-2 py-[2px] rounded-md bg-chip-neutral-bg text-chip-neutral-text whitespace-nowrap">
              Scored
            </span>
          </div>
          <div className="text-[15px] font-medium text-text-primary shrink-0">
            68<span className="text-[10px] text-text-secondary">/100</span>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
