"use client";

import { useEffect, useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { authFetch } from "@/lib/auth/authFetch";
import { TemplatePreviewModal } from "@/components/resume/TemplatePreviewModal";
import { Skeleton } from "@/components/Skeleton";
import Image from "next/image";

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

function ModernPreview() {
  return (
    <div className="relative w-full h-full">
      <Image
        src="/templates/modern/preview.png"
        alt="Modern resume template preview"
        fill
        className="object-contain"
      />
    </div>
  );
}



const PREVIEWS: Record<string, React.ComponentType> = {
  modern: ModernPreview,
};

export function TemplateSelector({ selectedTemplateId, onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/api/templates")
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
    return (
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg p-[11px] bg-surface">
            <Skeleton className="h-20 sm:h-28 w-full mb-[10px]" />
            <Skeleton className="h-4 w-2/3 mb-1" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const previewTemplate = templates.find((t) => t.id === previewTemplateId) ?? null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {templates.map((template) => {
          const isSelected = template.id === selectedTemplateId;
          const Preview = PREVIEWS[template.id];
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
              className={`relative cursor-pointer rounded-lg p-[11px] bg-surface ${
                isSelected ? "shadow-[0_0_0_2px_var(--color-accent)]" : "shadow-[0_0_0_1px_var(--color-border-hairline)]"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-[18px] h-[18px] rounded-full bg-accent flex items-center justify-center z-10">
                  <IconCheck size={10} className="text-bg" />
                </div>
              )}
              <div className="h-20 sm:h-28 rounded-md overflow-hidden bg-surface-alt mb-[10px]">
                {Preview ? <Preview /> : null}
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[13px] font-medium text-text-primary">{template.name}</div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewTemplateId(template.id);
                  }}
                  className="text-[11.5px] text-accent bg-transparent border-none cursor-pointer shrink-0"
                >
                  Preview
                </button>
              </div>
              <p className="text-[11.5px] text-text-secondary leading-tight mt-0.5">{template.description}</p>
            </div>
          );
        })}
      </div>

      {previewTemplate && (
        <TemplatePreviewModal
          templateName={previewTemplate.name}
          onClose={() => setPreviewTemplateId(null)}
          onUseTemplate={() => onSelect(previewTemplate.id)}
        />
      )}
    </>
  );
}
