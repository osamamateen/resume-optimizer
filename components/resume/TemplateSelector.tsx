"use client";

import { useEffect, useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { authFetch } from "@/lib/auth/authFetch";
import { TemplatePreviewModal } from "@/components/resume/TemplatePreviewModal";
import { Spinner } from "@/components/Spinner";

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
    <svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="240" height="120" fill="white" />
      <rect x="0" y="0" width="4" height="120" fill="#2563EB" />
      <text x="14" y="18" fontSize="9" fontWeight="bold" fill="#1a1a1a" fontFamily="system-ui,sans-serif">
        Alex Johnson
      </text>
      <text x="14" y="27" fontSize="5" fill="#6B7280" fontFamily="system-ui,sans-serif">
        alex@email.com · San Francisco, CA
      </text>
      <line x1="14" y1="33" x2="226" y2="33" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="14" y="42" fontSize="5.5" fontWeight="bold" fill="#2563EB" letterSpacing="0.8" fontFamily="system-ui,sans-serif">
        EXPERIENCE
      </text>
      <text x="14" y="51" fontSize="5.5" fontWeight="bold" fill="#1a1a1a" fontFamily="system-ui,sans-serif">
        Senior Software Engineer
      </text>
      <text x="14" y="58" fontSize="4.5" fill="#6B7280" fontFamily="system-ui,sans-serif">
        Acme Corp · 2021–Present
      </text>
      <rect x="14" y="62" width="60" height="2" rx="1" fill="#e2e8f0" />
      <rect x="14" y="66" width="80" height="2" rx="1" fill="#e2e8f0" />
      <rect x="14" y="70" width="50" height="2" rx="1" fill="#e2e8f0" />
      <text x="14" y="83" fontSize="5.5" fontWeight="bold" fill="#2563EB" letterSpacing="0.8" fontFamily="system-ui,sans-serif">
        SKILLS
      </text>
      <rect x="14" y="87" width="30" height="9" rx="3.5" fill="#EFF6FF" />
      <text x="29" y="93.5" fontSize="4" fill="#2563EB" textAnchor="middle" fontFamily="system-ui,sans-serif">
        Python
      </text>
      <rect x="48" y="87" width="28" height="9" rx="3.5" fill="#EFF6FF" />
      <text x="62" y="93.5" fontSize="4" fill="#2563EB" textAnchor="middle" fontFamily="system-ui,sans-serif">
        React
      </text>
      <rect x="80" y="87" width="30" height="9" rx="3.5" fill="#EFF6FF" />
      <text x="95" y="93.5" fontSize="4" fill="#2563EB" textAnchor="middle" fontFamily="system-ui,sans-serif">
        Docker
      </text>
      <rect x="114" y="87" width="24" height="9" rx="3.5" fill="#EFF6FF" />
      <text x="126" y="93.5" fontSize="4" fill="#2563EB" textAnchor="middle" fontFamily="system-ui,sans-serif">
        AWS
      </text>
    </svg>
  );
}

function MinimalPreview() {
  return (
    <svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="240" height="120" fill="#fafaf9" />
      <text x="120" y="16" fontSize="10" fontWeight="bold" fill="#1a1a1a" fontFamily="Georgia,serif" textAnchor="middle">
        Alex Johnson
      </text>
      <text x="120" y="24" fontSize="4.5" fill="#555" textAnchor="middle" fontFamily="system-ui,sans-serif">
        alex@email.com · San Francisco, CA
      </text>
      <line x1="20" y1="29" x2="220" y2="29" stroke="#1a1a1a" strokeWidth="0.5" />
      <line x1="20" y1="38" x2="220" y2="38" stroke="#1a1a1a" strokeWidth="0.5" />
      <text x="120" y="36" fontSize="5.5" fontWeight="bold" fontFamily="Georgia,serif" textAnchor="middle" fill="#1a1a1a">
        EXPERIENCE
      </text>
      <text x="20" y="48" fontSize="5.5" fontWeight="bold" fontFamily="system-ui,sans-serif" fill="#1a1a1a">
        Senior Software Engineer
      </text>
      <text x="220" y="48" fontSize="4.5" fontFamily="system-ui,sans-serif" textAnchor="end" fill="#555">
        2021–Present
      </text>
      <rect x="20" y="52" width="60" height="2" rx="1" fill="#d0d0d0" />
      <rect x="20" y="56" width="80" height="2" rx="1" fill="#d0d0d0" />
      <rect x="20" y="60" width="50" height="2" rx="1" fill="#d0d0d0" />
      <line x1="20" y1="72" x2="220" y2="72" stroke="#1a1a1a" strokeWidth="0.5" />
      <line x1="20" y1="80" x2="220" y2="80" stroke="#1a1a1a" strokeWidth="0.5" />
      <text x="120" y="78" fontSize="5.5" fontWeight="bold" fontFamily="Georgia,serif" textAnchor="middle" fill="#1a1a1a">
        SKILLS
      </text>
      <text x="20" y="90" fontSize="4.5" fill="#1a1a1a" fontFamily="system-ui,sans-serif">
        Python, React, Docker, AWS, TypeScript
      </text>
    </svg>
  );
}

const PREVIEWS: Record<string, React.ComponentType> = {
  modern: ModernPreview,
  minimal: MinimalPreview,
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
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Spinner />
        Loading templates...
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
