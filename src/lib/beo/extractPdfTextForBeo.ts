import { extractRawTextFromPdf, type ExtractedRawText, type RawTextPageSegment } from "@/lib/beo/extractRawTextFromPdf";
import { renderPdfPagesToPng } from "@/lib/beo/pdfRenderPagesPng";
import { isVisionOcrConfigured, ocrPngWithVision } from "@/lib/beo/visionOcr";

export type ExtractedPdfTextForBeo = ExtractedRawText & { usedVisionOcr: boolean };

function visionOcrMaxPages(): number {
  const n = Number(process.env.VISION_OCR_MAX_PAGES);
  if (Number.isFinite(n) && n > 0) return Math.min(25, Math.floor(n));
  return 10;
}

function forceVisionFromEnv(): boolean {
  return process.env.BEO_FORCE_VISION_OCR === "1" || process.env.BEO_FORCE_VISION_OCR === "true";
}

/** True when native text is too thin to trust for BEO parsing (common for scanned PDFs). */
function shouldPreferVisionOverNative(text: string): boolean {
  if (forceVisionFromEnv()) return true;
  const t = text.trim();
  if (t.length < 100) return true;
  const letters = (t.match(/[A-Za-z]/g) ?? []).length;
  const digits = (t.match(/\d/g) ?? []).length;
  const alnum = letters + digits;
  if (alnum < 50) return true;
  if (alnum / Math.max(t.length, 1) < 0.08) return true;
  const hasOperationalAnchors =
    /\b(time\s+function\s+room|exp\/gtd|banquet remarks|billing instructions|flow of event|beverage service)\b/i.test(t);
  if (!hasOperationalAnchors && t.length < 1800) return true;
  return false;
}

async function extractViaVision(buffer: Buffer): Promise<ExtractedPdfTextForBeo> {
  const maxPages = visionOcrMaxPages();
  const rendered = await renderPdfPagesToPng(buffer, maxPages);
  const pages: RawTextPageSegment[] = [];
  for (const { pageNumber, png } of rendered) {
    const text = (await ocrPngWithVision(png)).trim();
    pages.push({ pageNumber, text });
  }
  const joined = pages.map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`).join("\n\n").trim();
  if (!joined) {
    throw new Error("Google Cloud Vision returned no text for rendered PDF pages.");
  }
  return { text: joined, pages, usedVisionOcr: true };
}

/**
 * Native pdf-parse text first; if empty / low-signal or native extraction fails, rasterize pages and OCR with Vision
 * when credentials are configured (`GOOGLE_CLOUD_VISION_API_KEY` and/or service account env).
 */
export async function extractPdfTextForBeo(buffer: Buffer): Promise<ExtractedPdfTextForBeo> {
  let native: ExtractedRawText | null = null;
  let nativeError: Error | null = null;

  try {
    native = await extractRawTextFromPdf(buffer);
  } catch (e) {
    nativeError = e instanceof Error ? e : new Error(String(e));
  }

  if (native && !shouldPreferVisionOverNative(native.text)) {
    return { ...native, usedVisionOcr: false };
  }

  if (!isVisionOcrConfigured()) {
    if (native) return { ...native, usedVisionOcr: false };
    throw nativeError ?? new Error("PDF text extraction failed.");
  }

  try {
    return await extractViaVision(buffer);
  } catch (visionErr) {
    const vmsg = visionErr instanceof Error ? visionErr.message : String(visionErr);
    if (native?.text.trim()) {
      return { ...native, usedVisionOcr: false };
    }
    const nmsg = nativeError?.message ?? "native extraction failed";
    throw new Error(`${nmsg} Vision OCR fallback: ${vmsg}`);
  }
}
