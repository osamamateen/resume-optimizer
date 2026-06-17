"use client";

import { useEffect, useState } from "react";

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
}

interface TemplateSelectorProps {
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
}

export function TemplateSelector({ selectedTemplateId, onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => res.json())
      .then((data: TemplateOption[]) => {
        setTemplates(data);
      })
      .catch(() => {
        setTemplates([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-500">Loading templates...</p>;
  }

  return (
    <div className="flex flex-wrap gap-4 sm:flex-row flex-col">
      {templates.map((template) => {
        const isSelected = template.id === selectedTemplateId;
        return (
          <div
            key={template.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(template.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(template.id);
              }
            }}
            className={`relative cursor-pointer rounded-lg border bg-white p-3 hover:shadow-md transition-shadow ${
              isSelected ? "ring-2 ring-blue-600 border-blue-600" : "border-gray-200"
            }`}
          >
            {isSelected && (
              <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                ✓
              </span>
            )}
            <ThumbnailImage src={template.thumbnail} alt={template.name} />
            <p className="mt-2 font-semibold text-sm">{template.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{template.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function ThumbnailImage({ src, alt }: { src: string; alt: string }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <img
      src={src}
      alt={alt}
      width={160}
      height={100}
      style={{ width: 160, height: 100, objectFit: "cover", display: "block" }}
      onError={() => setVisible(false)}
    />
  );
}
