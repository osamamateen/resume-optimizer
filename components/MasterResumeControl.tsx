"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
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

  return (
    <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <span className="text-gray-600 dark:text-gray-300 truncate">
        Master resume: {fileName ?? "none uploaded yet"}
      </span>
      <div {...getRootProps()} className="shrink-0 ml-3">
        <input {...getInputProps()} />
        <button type="button" disabled={uploading} className="text-blue-600 hover:text-blue-700 disabled:opacity-50">
          {uploading ? "Uploading..." : fileName ? "Replace" : "Upload"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 ml-3">{error}</p>}
    </div>
  );
}
