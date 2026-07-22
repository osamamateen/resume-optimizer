import pdf from "pdf-parse";

// PDF is positional, not a flow document — there's no safe way to mutate text in
// place without breaking layout, so PDF uploads only ever feed the clean-template
// rendering path, never in-place editing.
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const result = await pdf(buffer);
    return result.text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("Failed to extract text from PDF");
  }
}
