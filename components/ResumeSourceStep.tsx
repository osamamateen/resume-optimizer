"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { IconFileUpload, IconFileTypePdf, IconCheck, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";

export type ResumeSource =
  | { useMaster: true }
  | { useMaster: false; file: File; saveAsMaster: boolean };

interface ResumeSourceStepProps {
  masterResumeFileName: string | null;
  onBack: () => void;
  onNext: (source: ResumeSource) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumeSourceStep({ masterResumeFileName, onBack, onNext }: ResumeSourceStepProps) {
  const hasMaster = masterResumeFileName !== null;
  const [useUpload, setUseUpload] = useState(!hasMaster);
  const [file, setFile] = useState<File | null>(null);
  const [saveAsMaster, setSaveAsMaster] = useState(true);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
  });

  const showUpload = useUpload || !hasMaster;
  const canProceed = hasMaster && !useUpload ? true : file !== null;

  function handleNext() {
    if (hasMaster && !useUpload) {
      onNext({ useMaster: true });
      return;
    }
    if (!file) return;
    onNext({ useMaster: false, file, saveAsMaster: hasMaster ? false : saveAsMaster });
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">Resume</p>

      {hasMaster && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="radio" name="resumeSource" checked={!useUpload} onChange={() => setUseUpload(false)} />
            Use my master resume ({masterResumeFileName})
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="radio" name="resumeSource" checked={useUpload} onChange={() => setUseUpload(true)} />
            Upload a different resume for this application
          </label>
        </div>
      )}

      {showUpload && (
        <div className="space-y-3">
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

          {!hasMaster && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={saveAsMaster} onChange={(e) => setSaveAsMaster(e.target.checked)} />
              Save as my master resume
            </label>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
        >
          <IconArrowLeft size={16} /> Back
        </button>
        <button
          type="button"
          disabled={!canProceed}
          onClick={handleNext}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          Next <IconArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
