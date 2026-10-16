import type { RawJobInput } from "../../api/schemas/raw-job-input.schema.js";

export type RequirementExtractionInput = {
  title: string;
  company: string | null;
  description: string | null;
  location: string | null;
  source: string;
  sourceJobId: string | null;
  url: string;
  metadata: Record<string, unknown> | null;
};

const RELEVANT_METADATA_KEYS = [
  "salary",
  "salary_min",
  "salary_max",
  "contract",
  "employment_type",
  "working_hours",
  "remote",
  "hybrid",
  "city",
  "country"
] as const;

function selectRelevantMetadata(
  metadata: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const selected = Object.fromEntries(
    RELEVANT_METADATA_KEYS
      .filter((key) => key in metadata)
      .map((key) => [key, metadata[key]])
  );

  return Object.keys(selected).length > 0 ? selected : null;
}

export function buildRequirementExtractionInput(
  input: RawJobInput
): RequirementExtractionInput {
  return {
    title: input.title,
    company: input.company,
    description: input.description ?? null,
    location: input.location ?? null,
    source: input.source,
    sourceJobId: input.source_job_id ?? null,
    url: input.url,
    metadata: selectRelevantMetadata(input.raw_metadata ?? null)
  };
}