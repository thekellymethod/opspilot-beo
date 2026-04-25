import { createClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { BeoSourceRecord, NormalizedBeoRecord, ParseStatus, RawBeoExtraction, RawTextStatus, ValidationResult } from "@/lib/beo/types";
import type { ParsedBEO } from "@/lib/types";
import { saveVersion } from "@/lib/store";

const memorySources: BeoSourceRecord[] = [];
const LOCAL_SOURCES_PATH = path.join(process.cwd(), ".opspilot-local-sources.json");
let memorySourcesLoaded = false;

async function loadLocalSources(): Promise<void> {
  if (memorySourcesLoaded) return;
  memorySourcesLoaded = true;
  try {
    const raw = await fs.readFile(LOCAL_SOURCES_PATH, "utf8");
    const parsed = JSON.parse(raw) as { sources?: BeoSourceRecord[] };
    if (Array.isArray(parsed.sources)) {
      memorySources.push(...parsed.sources);
    }
  } catch {
    // Local file may not exist yet.
  }
}

async function persistLocalSources(): Promise<void> {
  await fs.writeFile(LOCAL_SOURCES_PATH, JSON.stringify({ sources: memorySources }, null, 2), "utf8");
}

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getServiceClient() {
  if (!hasSupabaseConfig()) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function rowToRecord(row: Record<string, unknown>): BeoSourceRecord {
  return {
    id: String(row.id),
    source_type: row.source_type as BeoSourceRecord["source_type"],
    filename: (row.filename as string | null) ?? null,
    property_id: (row.property_id as string | null) ?? null,
    uploaded_by: (row.uploaded_by as string | null) ?? null,
    uploaded_at: String(row.uploaded_at),
    sender: (row.sender as string | null) ?? null,
    linked_event_id: (row.linked_event_id as string | null) ?? null,
    revision_sequence: row.revision_sequence != null ? Number(row.revision_sequence) : null,
    raw_text: String(row.raw_text ?? ""),
    cleaned_text: (row.cleaned_text as string | null) ?? null,
    raw_text_status: row.raw_text_status as RawTextStatus,
    parse_status: row.parse_status as ParseStatus,
    storage_url: (row.storage_url as string | null) ?? null,
    prompt_version: (row.prompt_version as string | null) ?? null,
    latest_ai_extraction: (row.latest_ai_extraction as RawBeoExtraction | null) ?? null,
    latest_normalized: (row.latest_normalized as NormalizedBeoRecord | null) ?? null,
    latest_validation: (row.latest_validation as ValidationResult | null) ?? null,
    requires_human_review: Boolean(row.requires_human_review),
  };
}

export async function createBeoSource(input: {
  source_type: BeoSourceRecord["source_type"];
  filename?: string | null;
  property_id?: string | null;
  uploaded_by?: string | null;
  sender?: string | null;
  linked_event_id?: string | null;
  revision_sequence?: number | null;
  raw_text: string;
  raw_text_status?: RawTextStatus;
  storage_url?: string | null;
}): Promise<BeoSourceRecord> {
  const id = crypto.randomUUID();
  const record: BeoSourceRecord = {
    id,
    source_type: input.source_type,
    filename: input.filename ?? null,
    property_id: input.property_id ?? null,
    uploaded_by: input.uploaded_by ?? null,
    uploaded_at: new Date().toISOString(),
    sender: input.sender ?? null,
    linked_event_id: input.linked_event_id ?? null,
    revision_sequence: input.revision_sequence ?? null,
    raw_text: input.raw_text,
    cleaned_text: null,
    raw_text_status: input.raw_text_status ?? (input.raw_text.trim() ? "complete" : "pending"),
    parse_status: "pending",
    storage_url: input.storage_url ?? null,
    prompt_version: null,
    latest_ai_extraction: null,
    latest_normalized: null,
    latest_validation: null,
    requires_human_review: false,
  };

  const supabase = getServiceClient();
  if (!supabase) {
    await loadLocalSources();
    memorySources.push(record);
    await persistLocalSources();
    return record;
  }

  const { error } = await supabase.from("beo_sources").insert({
    id: record.id,
    source_type: record.source_type,
    filename: record.filename,
    property_id: record.property_id,
    uploaded_by: record.uploaded_by,
    uploaded_at: record.uploaded_at,
    sender: record.sender,
    linked_event_id: record.linked_event_id,
    revision_sequence: record.revision_sequence,
    raw_text: record.raw_text,
    cleaned_text: record.cleaned_text,
    raw_text_status: record.raw_text_status,
    parse_status: record.parse_status,
    storage_url: record.storage_url,
    prompt_version: record.prompt_version,
    latest_ai_extraction: record.latest_ai_extraction,
    latest_normalized: record.latest_normalized,
    latest_validation: record.latest_validation,
    requires_human_review: record.requires_human_review,
  });

  if (error) {
    throw new Error(
      `beo_sources insert failed: ${error.message}. Apply supabase/schema.sql (table beo_sources) or fix RLS/policies.`,
    );
  }

  return record;
}

export async function getBeoSource(id: string): Promise<BeoSourceRecord | null> {
  const supabase = getServiceClient();
  if (!supabase) {
    await loadLocalSources();
    return memorySources.find((s) => s.id === id) ?? null;
  }
  const { data } = await supabase.from("beo_sources").select("*").eq("id", id).maybeSingle();
  return data ? rowToRecord(data as Record<string, unknown>) : null;
}

export async function updateBeoSource(
  id: string,
  patch: Partial<
    Pick<
      BeoSourceRecord,
      | "raw_text"
      | "cleaned_text"
      | "raw_text_status"
      | "parse_status"
      | "latest_ai_extraction"
      | "latest_normalized"
      | "latest_validation"
      | "prompt_version"
      | "requires_human_review"
      | "linked_event_id"
    >
  >,
): Promise<BeoSourceRecord> {
  const supabase = getServiceClient();
  if (!supabase) {
    await loadLocalSources();
    const idx = memorySources.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Source not found");
    memorySources[idx] = { ...memorySources[idx], ...patch };
    await persistLocalSources();
    return memorySources[idx];
  }
  const { data, error } = await supabase.from("beo_sources").update(patch).eq("id", id).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Update failed");
  return rowToRecord(data as Record<string, unknown>);
}

export async function promoteSourceToLiveEvent(
  sourceId: string,
  payload: {
    rawText: string;
    cleanedText: string;
    parsed: ParsedBEO;
    normalized: NormalizedBeoRecord;
    validation: ValidationResult;
  },
): Promise<{ event: import("@/lib/types").EventRecord; version: import("@/lib/types").EventVersionRecord }> {
  const source = await getBeoSource(sourceId);
  const { event, version } = await saveVersion({
    rawText: payload.rawText,
    parsed: payload.parsed,
    normalized: payload.normalized,
    sourceUrl: source?.storage_url ?? null,
    eventIdHint: source?.linked_event_id ?? undefined,
  });

  await updateBeoSource(sourceId, {
    linked_event_id: event.id,
    parse_status: "approved",
    requires_human_review: false,
    latest_normalized: payload.normalized,
    latest_validation: payload.validation,
    cleaned_text: payload.cleanedText,
  });

  return { event, version };
}
