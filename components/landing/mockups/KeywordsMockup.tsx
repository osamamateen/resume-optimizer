"use client";

const matched = ["Roadmapping", "Cross-functional", "Agile"];
const missing = ["SQL", "A/B testing", "Stakeholder mgmt"];

export function KeywordsMockup() {
  return (
    <div className="flex flex-col gap-4 p-6 w-full max-w-[280px]">
      <div>
        <div className="text-[9px] tracking-wide text-text-secondary uppercase mb-2">Matched keywords</div>
        <div className="flex flex-wrap gap-[6px]">
          {matched.map((kw) => (
            <span key={kw} className="text-[10.5px] px-[9px] py-[3px] rounded-md bg-accent-surface text-accent-surface-text">
              {kw}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[9px] tracking-wide text-text-secondary uppercase mb-2">Missing keywords</div>
        <div className="flex flex-wrap gap-[6px]">
          {missing.map((kw) => (
            <span key={kw} className="text-[10.5px] px-[9px] py-[3px] rounded-md bg-chip-neutral-bg text-chip-neutral-text">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
