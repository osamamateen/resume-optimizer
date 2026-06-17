import { PDFParse } from "pdf-parse";

// PDF is positional, not a flow document — there's no safe way to mutate text in
// place without breaking layout, so PDF uploads only ever feed the clean-template
// rendering path, never in-place editing.
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
