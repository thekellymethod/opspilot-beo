import { GoogleAuth } from "google-auth-library";

/** Covers Vision `images:annotate` when using a service account. */
const VISION_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

function hasApiKey(): boolean {
  return Boolean(process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim());
}

function hasServiceAccountEnv(): boolean {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim(),
  );
}

/** True when Vision OCR can run (API key or service account env). */
export function isVisionOcrConfigured(): boolean {
  return hasApiKey() || hasServiceAccountEnv();
}

async function getBearerTokenForVision(): Promise<string> {
  const json = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (json) {
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(json) as Record<string, unknown>;
    } catch {
      throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON.");
    }
    const auth = new GoogleAuth({ credentials, scopes: [VISION_SCOPE] });
    const client = await auth.getClient();
    const access = await client.getAccessToken();
    if (!access.token) {
      throw new Error("Vision OAuth: empty access token (check service account JSON).");
    }
    return access.token;
  }

  const auth = new GoogleAuth({ scopes: [VISION_SCOPE] });
  const client = await auth.getClient();
  const access = await client.getAccessToken();
  if (!access.token) {
    throw new Error("Vision OAuth: empty access token (set GOOGLE_APPLICATION_CREDENTIALS or *_JSON).");
  }
  return access.token;
}

type VisionAnnotateResponse = {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    textAnnotations?: Array<{ description?: string }>;
    error?: { message?: string };
  }>;
};

/**
 * OCR a single PNG (e.g. a rendered PDF page) with Cloud Vision DOCUMENT_TEXT_DETECTION.
 */
export async function ocrPngWithVision(pngBuffer: Buffer): Promise<string> {
  const body = {
    requests: [
      {
        image: { content: pngBuffer.toString("base64") },
        features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
      },
    ],
  };

  let url = "https://vision.googleapis.com/v1/images:annotate";
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY?.trim();
  if (apiKey) {
    url += `?key=${encodeURIComponent(apiKey)}`;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!apiKey) {
    headers.Authorization = `Bearer ${await getBearerTokenForVision()}`;
  }

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const json = (await res.json()) as VisionAnnotateResponse;

  if (!res.ok) {
    const msg = JSON.stringify(json).slice(0, 500);
    throw new Error(`Vision API HTTP ${res.status}: ${msg}`);
  }

  const first = json.responses?.[0];
  if (first?.error?.message) {
    throw new Error(`Vision API: ${first.error.message}`);
  }

  const doc = first?.fullTextAnnotation?.text?.trim();
  if (doc) return doc;

  const fallback = first?.textAnnotations?.[0]?.description?.trim();
  return fallback ?? "";
}
