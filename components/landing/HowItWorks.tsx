"use client";

interface Step {
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    title: "Upload your master resume",
    description: "Do it once — every future application reuses it automatically.",
  },
  {
    title: "Paste the job description",
    description: "Add the company, role, and posting text for the job you're applying to.",
  },
  {
    title: "Score, then optimize",
    description: "See your ATS score and keyword gaps first, then optimize and download when you're ready.",
  },
];

export function HowItWorks() {
  return (
    <section className="max-w-[1100px] mx-auto px-[clamp(24px,6vw,64px)] py-[clamp(56px,9vw,88px)]">
      <div className="text-center mb-[clamp(40px,6vw,56px)]">
        <h2 className="text-[clamp(26px,3.5vw,36px)] font-medium tracking-[-0.015em]">How it works</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {steps.map((step, i) => (
          <div key={step.title} className="flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-surface flex items-center justify-center text-accent-surface-text text-[15px] font-medium">
              {i + 1}
            </div>
            <h3 className="text-[16px] font-medium">{step.title}</h3>
            <p className="text-[13.5px] text-text-secondary leading-relaxed max-w-[280px]">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
