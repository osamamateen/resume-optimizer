"use client";

interface ConfirmDeleteModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({ title, message, confirmLabel, loading, onCancel, onConfirm }: ConfirmDeleteModalProps) {
  return (
    <div onClick={onCancel} className="fixed inset-0 flex items-center justify-center p-6 bg-black/50 z-50">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[380px] flex flex-col gap-[14px] p-[18px] rounded-card bg-surface shadow-[0_0_0_1px_var(--color-border-hairline),0_16px_40px_rgba(0,0,0,0.4)]"
      >
        <div className="text-[16px] font-medium text-text-primary">{title}</div>
        <div className="text-[13.5px] text-text-secondary leading-relaxed">{message}</div>
        <div className="flex justify-end gap-[9px] mt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-[9px] border border-border-hairline rounded-lg bg-transparent text-text-primary text-sm cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-[9px] border border-red-600 dark:border-red-400 rounded-lg bg-transparent text-red-600 dark:text-red-400 text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            {loading ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
