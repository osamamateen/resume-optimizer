"use client";

import { useState } from "react";

interface TagListEditorProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function TagListEditor({ label, values, onChange, placeholder }: TagListEditorProps) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...values, trimmed]);
    setDraft("");
  }

  function removeTag(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="block text-[12px] mb-[5px] text-text-secondary">{label}</label>
      <div className="flex flex-wrap gap-[6px] mb-2">
        {values.map((value, index) => (
          <span
            key={index}
            className="flex items-center gap-[6px] text-[11px] px-[10px] py-[3px] rounded-md bg-chip-neutral-bg text-chip-neutral-text"
          >
            {value}
            <button
              type="button"
              onClick={() => removeTag(index)}
              aria-label={`Remove ${value}`}
              className="cursor-pointer leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-h-[34px] px-3 py-2 text-[13.5px] text-text-primary bg-surface border border-border-hairline rounded-lg outline-none"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-3 py-2 border border-border-hairline rounded-lg bg-transparent text-text-primary text-[13px] cursor-pointer"
        >
          Add
        </button>
      </div>
    </div>
  );
}
