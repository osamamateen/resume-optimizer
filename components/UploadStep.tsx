"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface UploadStepProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onNext: () => void;
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
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={`rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <p className="font-medium">{file.name}</p>
        ) : (
          <p className="text-gray-500">Drag & drop your resume here, or click to choose a .docx or .pdf file</p>
        )}
      </div>

      <button
        type="button"
        disabled={!file}
        onClick={onNext}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
