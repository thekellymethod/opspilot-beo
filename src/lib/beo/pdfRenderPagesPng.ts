import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { ensurePdfJsGlobalWorker } from "@/lib/beo/pdfJsNode";

/**
 * Minimal canvas factory for pdf.js server rendering (matches DOMCanvasFactory contract).
 * @see https://github.com/mozilla/pdf.js/blob/master/examples/node/domstubs.js
 */
class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context unavailable.");
    }
    return { canvas: canvas as unknown as HTMLCanvasElement, context };
  }

  reset(
    canvasAndContext: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D },
    width: number,
    height: number,
  ) {
    canvasAndContext.canvas.width = Math.ceil(width);
    canvasAndContext.canvas.height = Math.ceil(height);
  }

  destroy(canvasAndContext: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }) {
    (canvasAndContext.canvas as unknown as Canvas).width = 0;
    (canvasAndContext.canvas as unknown as Canvas).height = 0;
    canvasAndContext.canvas.remove?.();
  }
}

export type RenderedPdfPagePng = {
  pageNumber: number;
  png: Buffer;
};

/**
 * Rasterize the first `maxPages` of a PDF to PNG buffers for OCR (Vision, etc.).
 */
export async function renderPdfPagesToPng(
  pdfBuffer: Buffer,
  maxPages: number,
  scale = 2,
): Promise<RenderedPdfPagePng[]> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as typeof import("pdfjs-dist/legacy/build/pdf.mjs");
  ensurePdfJsGlobalWorker(pdfjs);

  const canvasFactory = new NodeCanvasFactory();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0,
    disableFontFace: true,
    useSystemFonts: false,
    CanvasFactory: canvasFactory,
  });

  const pdf = await loadingTask.promise;
  const out: RenderedPdfPagePng[] = [];
  const n = Math.min(pdf.numPages, Math.max(1, maxPages));

  for (let pageNum = 1; pageNum <= n; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const { canvas, context: ctx } = canvasFactory.create(viewport.width, viewport.height);

    await page
      .render({
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      })
      .promise;

    const png = (canvas as unknown as Canvas).toBuffer("image/png");
    out.push({ pageNumber: pageNum, png });
    page.cleanup();
    canvasFactory.destroy({
      canvas,
      context: ctx as unknown as CanvasRenderingContext2D,
    });
  }

  await pdf.destroy();

  return out;
}
