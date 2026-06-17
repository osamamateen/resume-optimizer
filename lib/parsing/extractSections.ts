import type { DocxSegment } from "./docx";

export interface ResumeSection {
  id: string;
  heading: string | null;
  originalText: string;
}

export interface OptimizedSection extends ResumeSection {
  optimizedText: string;
}

const KNOWN_HEADINGS = new Set([
  "SUMMARY",
  "PROFESSIONAL SUMMARY",
  "OBJECTIVE",
  "EXPERIENCE",
  "WORK EXPERIENCE",
  "EMPLOYMENT HISTORY",
  "EDUCATION",
  "SKILLS",
  "TECHNICAL SKILLS",
  "PROJECTS",
  "CERTIFICATIONS",
  "AWARDS",
  "PUBLICATIONS",
  "LANGUAGES",
  "INTERESTS",
]);

// Heuristic only — used to give the AI section context and to choose heading
// styling in the clean-template renderers. Not used for in-place DOCX editing,
// where original formatting is preserved regardless of what this detects.
export function looksLikeHeading(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (KNOWN_HEADINGS.has(trimmed.toUpperCase())) return true;
  const isAllCaps = trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed);
  return isAllCaps && trimmed.split(/\s+/).length <= 4;
}

// A heading segment carries heading: null (it IS the heading); body segments
// inherit the most recently seen heading so the AI knows which part of the
// resume it's editing.
export function sectionsFromDocxSegments(segments: DocxSegment[]): ResumeSection[] {
  let currentHeading: string | null = null;
  return segments.map(({ id, text }) => {
    if (looksLikeHeading(text)) {
      currentHeading = text.trim();
      return { id, heading: null, originalText: text };
    }
    return { id, heading: currentHeading, originalText: text };
  });
}

export function sectionsFromPlainText(text: string): ResumeSection[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let currentHeading: string | null = null;
  let counter = 0;
  return lines.map((line) => {
    const id = `seg-${counter++}`;
    if (looksLikeHeading(line)) {
      currentHeading = line;
      return { id, heading: null, originalText: line };
    }
    return { id, heading: currentHeading, originalText: line };
  });
}
