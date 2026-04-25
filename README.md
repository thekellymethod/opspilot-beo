# OpsPilot BEO (MVP)

OpsPilot BEO converts BEO documents into structured operations, deterministic department tasking, and concise briefings.

## MVP Scope

1. Accept BEO (`PDF` or pasted text)
2. Extract/normalize event data
3. Generate tasks by department (`kitchen`, `banquets`, `bar`)
4. Generate daily + pre-event briefings
5. Detect and alert on revisions

## Stack

- Next.js App Router
- API routes (Node runtime)
- PostgreSQL/Supabase schema in `supabase/schema.sql`
- Tailwind CSS UI
- OpenAI-compatible parser with deterministic fallback

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
cp .env.example .env.local
```

3. Apply DB schema in your Supabase SQL editor:

- `supabase/schema.sql`

4. Run:

```bash
npm run dev
```

## API Endpoints

- `POST /api/beo/upload` — creates `beo_sources`, runs pipeline, auto-promotes only when validation + routing allow
- `POST /api/beo/parse` — same pipeline for pasted text (immutable source row)
- `POST /api/beo/sources/[id]/promote` — body `{ "humanApproved": true }` or merged `normalized` after manager review
- `POST /api/events/[id]/generate-tasks`
- `POST /api/events/[id]/detect-changes`
- `GET /api/events/[id]/briefing` — query `level=executive|management|department`; body includes `briefingDoc` + legacy `briefing` string

## BEO extraction pipeline (controlled)

Stages: **intake (source)** → **raw text** → **cleanup** → **schema-bound AI extraction** (versioned prompt) → **normalization** → **validation** → **review routing** → optional **promote to live event**.

Core modules (starter layout):

- `src/lib/beo/types.ts`
- `src/lib/beo/schema.ts`
- `src/lib/beo/prompt.ts` (`buildBeoExtractionPrompt`, `BEO_EXTRACTION_PROMPT_VERSION`)
- `src/lib/beo/extract.ts` (`runBeoExtraction`)
- `src/lib/beo/normalize.ts` (`normalizeBeoFields`)
- `src/lib/beo/validate.ts` (`validateBeoRecord`)
- `src/lib/beo/review.ts` (`routeBeoForReview`)
- `src/lib/beo/process.ts` (`processBeo`)

Integration (DB / PDF):

- `src/lib/beo/extractRawTextFromPdf.ts`
- `src/lib/beo/cleanBeoText.ts` (noise stripping, label standardization, dedupe)
- `src/lib/beo/taskGenerator.ts` (deterministic `GeneratedTask[]` from `NormalizedBeoRecord`)
- `src/lib/beo/changeDetector.ts` (`detectOperationalChanges` → operational consequences)
- `src/lib/beo/briefingGenerator.ts` (`generateBriefing` — compressed `EventBriefing` + optional `?level=`)
- `src/lib/beo/mapToPersistence.ts` (bridge to `event_tasks` / `alerts` enums)
- `src/lib/beo/parsedBEOToNormalized.ts` (legacy rows without `normalized_json`)
- `src/lib/beo/processBeoSource.ts` (orchestrator)
- `src/lib/beo/sourceStore.ts` (`beo_sources` persistence)
- `src/lib/beo/toParsedBEO.ts` — adapter to legacy `ParsedBEO` for task/alert code

Legacy preview helper: `src/lib/beoParser.ts` (stateless; prefer pipeline + source for production).

Optional env: `BEO_PROPERTY_PROFILE_JSON` — property timezone, field aliases, service aliases, room capacities (see `src/lib/beo/propertyProfile.ts`).

## Core Modules

- `src/lib/beoParser.ts` (legacy / preview)

## Screens

- Dashboard: `/`
- Upload/Intake: `/upload`
- Event detail: `/events/[id]`
- Briefing view: `/events/[id]/briefing`
