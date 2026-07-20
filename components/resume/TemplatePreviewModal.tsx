"use client";

interface TemplatePreviewModalProps {
  templateName: string;
  onClose: () => void;
  onUseTemplate: () => void;
}

export function TemplatePreviewModal({ templateName, onClose, onUseTemplate }: TemplatePreviewModalProps) {
  return (
    <div onClick={onClose} className="fixed inset-0 flex items-center justify-center p-6 bg-black/50 z-50">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] max-h-[90vh] overflow-auto flex flex-col gap-[14px] p-[18px] rounded-card bg-surface shadow-[0_0_0_1px_var(--color-border-hairline),0_16px_40px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-medium text-text-primary">{templateName} template preview</div>
          <button
            type="button"
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-lg border border-border-hairline bg-transparent text-text-primary text-[15px] leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="rounded-lg bg-surface-alt border border-border-hairline flex flex-col items-center justify-center gap-2 py-16 px-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="2" width="14" height="16" rx="2" className="stroke-text-secondary" strokeWidth="1.5" />
            <path d="M6.5 7h7M6.5 10.5h7M6.5 14h4" className="stroke-text-secondary" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-text-secondary">Preview coming soon</p>
        </div>

        <button
          type="button"
          onClick={() => {
            onUseTemplate();
            onClose();
          }}
          className="self-end flex items-center gap-[7px] px-4 py-2 border border-accent rounded-lg bg-transparent text-accent text-[13.5px] font-medium cursor-pointer"
        >
          Use this template
        </button>
      </div>
    </div>
  );
}
