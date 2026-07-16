"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { IconFileUpload, IconFileTypePdf, IconCheck, IconArrowRight } from "@tabler/icons-react";

interface UploadStepProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onNext: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadStep({ file, onFileChange, onNext }: UploadStepProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFileChange(accepted[0]);
    },
    [onFileChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
  });

  return (
    <div className="space-y-4">
      {file ? (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center gap-3">
          <IconFileTypePdf className="text-blue-600 shrink-0" size={24} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate text-gray-900 dark:text-white">{file.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(file.size)} · ready to optimize</p>
          </div>
          <IconCheck className="text-green-500 shrink-0" size={20} />
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center bg-gray-50 dark:bg-gray-800 cursor-pointer transition-colors ${
            isDragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-300 dark:border-gray-700 hover:border-blue-500"
          }`}
        >
          <input {...getInputProps()} />
          <IconFileUpload className="mx-auto text-gray-400 dark:text-gray-500 mb-3" size={28} />
          <p className="font-medium text-sm text-gray-700 dark:text-gray-300">Drop your resume here</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF or DOCX · up to 5MB</p>
          <div className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1 text-xs text-gray-600 dark:text-gray-400 mt-3">
            Browse files
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!file}
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          Next <IconArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
