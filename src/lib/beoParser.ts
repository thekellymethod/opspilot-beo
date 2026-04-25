import { cleanBeoText } from "@/lib/beo/cleanBeoText";
import { loadPropertyProfile } from "@/lib/beo/propertyProfile";
import { processBeo } from "@/lib/beo/process";
import { normalizedToParsedBEO } from "@/lib/beo/toParsedBEO";
import type { ParsedBEO } from "@/lib/types";

/**
 * @deprecated Prefer `processBeoSource` + immutable `beo_sources` for production.
 * Stateless preview: cleanup → full pipeline (no persistence).
 */
export async function parseBEOText(rawText: string): Promise<ParsedBEO> {
  const cleaned = cleanBeoText(rawText);
  const profile = loadPropertyProfile(null);
  const { normalized } = await processBeo({
    cleanedText: cleaned,
    timezone: profile.timezone,
  });
  return normalizedToParsedBEO(normalized);
}
