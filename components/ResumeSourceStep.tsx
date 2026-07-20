"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { IconFileUpload, IconCheck, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";

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
    <div className="max-w-[480px] mx-auto">
      <div className="text-[11px] tracking-wide text-accent uppercase mb-[6px]">Resume</div>
      <div className="text-2xl font-medium mb-6 tracking-[-0.015em] text-text-primary">Which resume should we score?</div>

      <div className="flex flex-col gap-[11px]">
        {hasMaster && (
          <label
            className={`flex items-center gap-3 px-[15px] py-[13px] rounded-lg cursor-pointer ${
              !useUpload ? "bg-surface shadow-[0_0_0_1px_var(--color-accent)]" : "shadow-[0_0_0_1px_var(--color-border-hairline)]"
            }`}
          >
            <input type="radio" name="resumeSource" checked={!useUpload} onChange={() => setUseUpload(false)} className="sr-only" />
            <span
              className={`w-4 h-4 rounded-full border-[1.5px] shrink-0 ${
                !useUpload ? "border-accent bg-accent shadow-[inset_0_0_0_3px_var(--color-bg)]" : "border-border-hairline"
              }`}
            />
            <span className="text-sm text-text-primary">
              Use my master resume — <span className="text-text-secondary">{masterResumeFileName}</span>
            </span>
          </label>
        )}

        <label
          className={`flex items-center gap-3 px-[15px] py-[13px] rounded-lg cursor-pointer ${
            useUpload ? "bg-surface shadow-[0_0_0_1px_var(--color-accent)]" : "shadow-[0_0_0_1px_var(--color-border-hairline)]"
          }`}
        >
          <input type="radio" name="resumeSource" checked={useUpload} onChange={() => setUseUpload(true)} className="sr-only" />
          <span
            className={`w-4 h-4 rounded-full border-[1.5px] shrink-0 ${
              useUpload ? "border-accent bg-accent shadow-[inset_0_0_0_3px_var(--color-bg)]" : "border-border-hairline"
            }`}
          />
          <span className="text-sm text-text-primary">Upload a different resume for this application</span>
        </label>

        {showUpload && (
          <>
            <div
              {...getRootProps()}
              className={`border border-dashed rounded-lg px-5 py-[26px] text-center bg-surface-alt cursor-pointer ${
                isDragActive ? "border-accent" : "border-border-dashed"
              }`}
            >
              <input {...getInputProps()} />
              {file ? (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mx-auto mb-[10px] text-accent">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="text-sm text-text-primary">{file.name}</div>
                  <div className="text-xs text-text-secondary mt-1">{formatBytes(file.size)}</div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-[12.5px] text-accent mt-1 cursor-pointer bg-transparent border-none"
                  >
                    Choose a different file
                  </button>
                </>
              ) : (
                <>
                  <IconFileUpload size={22} className="mx-auto mb-[10px] text-text-secondary" />
                  <div className="text-sm text-text-primary mb-[2px]">Drop your resume here</div>
                  <div className="text-xs text-text-secondary mb-[14px]">PDF or DOCX · up to 5MB</div>
                  <span className="inline-block px-[14px] py-[7px] border border-border-hairline rounded-lg text-[13px] text-text-primary">
                    Browse files
                  </span>
                </>
              )}
            </div>

            {!hasMaster && (
              <label className="flex items-center gap-2 pl-[2px] cursor-pointer">
                <span
                  onClick={() => setSaveAsMaster((v) => !v)}
                  className={`w-[15px] h-[15px] rounded-[3px] border-[1.5px] flex items-center justify-center shrink-0 ${
                    saveAsMaster ? "border-accent bg-accent" : "border-border-hairline"
                  }`}
                >
                  {saveAsMaster && <IconCheck size={9} className="text-bg" strokeWidth={3} />}
                </span>
                <input
                  type="checkbox"
                  checked={saveAsMaster}
                  onChange={(e) => setSaveAsMaster(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-[13px] text-text-secondary">Save this as my new master resume</span>
              </label>
            )}
          </>
        )}

        <div className="flex justify-between mt-[8px]">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-[7px] px-4 py-[9px] border border-border-hairline rounded-lg bg-transparent text-text-primary text-sm cursor-pointer"
          >
            <IconArrowLeft size={13} />
            Back
          </button>
          <button
            type="button"
            disabled={!canProceed}
            onClick={handleNext}
            className="flex items-center gap-[7px] px-[18px] py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            Next
            <IconArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
