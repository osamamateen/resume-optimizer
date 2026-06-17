"use client";

interface JobDescriptionStepProps {
  jobDescription: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export function JobDescriptionStep({ jobDescription, onChange, onBack, onSubmit, loading }: JobDescriptionStepProps) {
  return (
    <div className="space-y-4">
      <textarea
        className="w-full rounded border p-3 h-64"
        placeholder="Paste the job description here..."
        value={jobDescription}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="rounded border px-4 py-2">
          Back
        </button>
        <button
          type="button"
          disabled={!jobDescription.trim() || loading}
          onClick={onSubmit}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "Optimizing..." : "Optimize resume"}
        </button>
      </div>
    </div>
  );
}
