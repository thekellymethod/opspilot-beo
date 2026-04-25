import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/** App directory (folder containing this config). Fixes Turbopack when a parent folder also has a lockfile. */
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactCompiler: true,
  /** Keep pdf.js out of the dev bundle so `import(workerSrc)` resolves to real files, not `[project]` virtual paths. */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "google-auth-library"],
  turbopack: {
    root: turbopackRoot,
  },
};

export default nextConfig;
