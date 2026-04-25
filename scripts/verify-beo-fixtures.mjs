import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");

const root = process.cwd();
const configPath = path.join(root, "examples", "beo-fixture-assertions.json");

function missingPatterns(text, patterns) {
  const normalized = text.toLowerCase();
  return patterns.filter((pattern) => !normalized.includes(pattern.toLowerCase()));
}

async function run() {
  const config = JSON.parse(await fs.readFile(configPath, "utf8"));
  const htmlPath = path.join(root, config.htmlFixturePath);
  const pdfPath = path.join(root, config.pdfFixturePath);

  const htmlText = await fs.readFile(htmlPath, "utf8");
  const pdfBuffer = await fs.readFile(pdfPath);
  const parser = new PDFParse({ data: pdfBuffer });
  const pdfResult = await parser.getText();
  const pdfText = typeof pdfResult.text === "string" ? pdfResult.text : "";
  await parser.destroy();

  const htmlMissing = missingPatterns(htmlText, config.htmlRequiredPatterns ?? []);
  const pdfMissing = missingPatterns(pdfText, config.pdfRequiredPatterns ?? []);

  if (htmlMissing.length || pdfMissing.length) {
    const parts = [];
    if (htmlMissing.length) parts.push(`HTML missing: ${htmlMissing.join(", ")}`);
    if (pdfMissing.length) parts.push(`PDF missing: ${pdfMissing.join(", ")}`);
    throw new Error(parts.join(" | "));
  }

  console.log("Fixture checks passed for Marriott-style BEO sources.");
}

run().catch((error) => {
  console.error("Fixture check failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
