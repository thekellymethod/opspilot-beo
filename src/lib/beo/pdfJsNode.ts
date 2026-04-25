import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PDFParse } from "pdf-parse";

let pdfWorkerConfigured = false;

/**
 * Real `pdf.worker.mjs` on disk for pdf.js (see `next.config.ts` serverExternalPackages).
 */
export function findPdfWorkerFilePath(): string {
  let dir = path.resolve(process.cwd());
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.mjs");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    "pdf.worker.mjs not found under node_modules/pdfjs-dist/legacy/build. Run npm install from the app folder.",
  );
}

/** pdf-parse uses the same pdf.js worker as direct pdfjs-dist usage. */
export function ensurePdfParseWorker(): void {
  if (pdfWorkerConfigured) return;
  pdfWorkerConfigured = true;
  PDFParse.setWorker(pathToFileURL(findPdfWorkerFilePath()).href);
}

/** Direct pdfjs-dist `GlobalWorkerOptions` (for canvas render path). */
export function ensurePdfJsGlobalWorker(pdfjs: { GlobalWorkerOptions: { workerSrc: string } }): void {
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(findPdfWorkerFilePath()).href;
}
