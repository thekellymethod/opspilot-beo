import { PDFParse } from "pdf-parse";
import { ensurePdfParseWorker } from "@/lib/beo/pdfJsNode";

export interface RawTextPageSegment {
  pageNumber: number;
  text: string;
}

export interface ExtractedRawText {
  text: string;
  pages: RawTextPageSegment[];
}

/**
 * Deterministic PDF text extraction first. OCR is intentionally not wired here —
 * call sites should branch to OCR when `pages` text length is near zero or quality heuristics fail.
 */
export async function extractRawTextFromPdf(buffer: Buffer): Promise<ExtractedRawText> {
  if (!buffer?.length) {
    throw new Error("PDF buffer is empty.");
  }

  ensurePdfParseWorker();

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const pageList = Array.isArray(result.pages) ? result.pages : [];
    const pages: RawTextPageSegment[] = pageList.map((page) => ({
      pageNumber: page.num,
      text: typeof page.text === "string" ? page.text : "",
    }));
    const joined = pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join("\n\n").trim();
    const fallback = typeof result.text === "string" ? result.text.trim() : "";
    const text = joined || fallback;
    if (!text) {
      throw new Error(
        "No extractable text in PDF (may be scanned images). Try pasting BEO text instead, or use OCR upstream.",
      );
    }
    return { text, pages };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`PDF text extraction failed: ${msg}`);
  } finally {
    try {
      await parser.destroy();
    } catch {
      /* ignore teardown errors */
    }
  }
}
