"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { IconFileText } from "@tabler/icons-react";
import { authFetch } from "@/lib/auth/authFetch";
import { useMasterResume } from "@/lib/hooks/useMasterResume";

export function MasterResumeControl() {
  const { fileName, loaded, reload } = useMasterResume(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("resume", file);
        const res = await authFetch("/api/master-resume", { method: "POST", body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(typeof body.error === "string" ? body.error : "Upload failed");
        }
        reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [reload]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    maxFiles: 1,
    noDrag: true,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
  });

  if (!loaded) return null;

  if (fileName) {
    return (
      <div className="flex items-center justify-between gap-3 bg-surface border border-accent-surface rounded-lg px-4 py-3 flex-wrap">
        <div className="flex items-center gap-[11px] min-w-0">
          <IconFileText size={17} className="text-accent shrink-0" />
          <div className="min-w-0">
            <div className="text-[10.5px] tracking-wide text-accent uppercase">Master resume</div>
            <div className="text-[13.5px] text-text-primary truncate">{fileName}</div>
          </div>
        </div>
        <div {...getRootProps()} className="shrink-0">
          <input {...getInputProps()} />
          <button
            type="button"
            disabled={uploading}
            className="border-none bg-transparent text-accent text-[13px] cursor-pointer disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Replace"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400 w-full">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-surface border border-border-hairline rounded-lg px-4 py-3 flex-wrap">
      <div className="text-[13.5px] text-text-secondary">
        No master resume yet — upload one so new applications can reuse it.
      </div>
      <div {...getRootProps()} className="shrink-0">
        <input {...getInputProps()} />
        <button
          type="button"
          disabled={uploading}
          className="border border-accent bg-transparent text-accent px-[14px] py-[7px] rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {uploading ? "Uploading..." : "Upload resume"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 w-full">{error}</p>}
    </div>
  );
}
