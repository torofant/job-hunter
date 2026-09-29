import type { RawJobInput } from "../../api/schemas/raw-job-input.schema.js";

export type JobEnrichmentInput = {
  title: string;
  company: string;
  description: string | null;
  location: string | null;
  source: string;
  sourceJobId: string | null;
  url: string;
  metadata: Record<string, unknown> | null;
};

export function buildJobEnrichmentInput(
  input: RawJobInput
): JobEnrichmentInput {
  return {
    title: input.title,
    company: input.company,
    description: input.description ?? null,
    location: input.location ?? null,
    source: input.source,
    sourceJobId: input.source_job_id ?? null,
    url: input.url,
    metadata: selectRelevantMetadata(input.raw_metadata)
  };
}

function selectRelevantMetadata(
  metadata: RawJobInput["raw_metadata"]
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const relevantKeys = [
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
  ];

  const selected = Object.fromEntries(
    relevantKeys
      .filter((key) => key in metadata)
      .map((key) => [key, metadata[key]])
  );

  return Object.keys(selected).length > 0 ? selected : null;
}