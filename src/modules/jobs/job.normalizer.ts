import { randomUUID } from "node:crypto";

import type { RawJobInput } from "../../api/schemas/raw-job-input.schema.js";
import type { InferInsertModel } from "drizzle-orm";
import { jobOffers } from "../../database/schema/index.js";

import { buildJobEnrichmentInput } from "./job-enrichment-input.js";
import { mergeJobEnrichment } from "./job-enrichment.js";
import type { JobEnrichmentService } from "./job-enrichment.service.js";

export type JobOfferCandidate = InferInsertModel<typeof jobOffers>;

export function normalizeUrl(url: string): string {
  const parsedUrl = new URL(url.trim());

  parsedUrl.hostname = parsedUrl.hostname.toLowerCase();

  return parsedUrl.toString();
}

export type NormalizedJobOfferResult = {
  candidate: JobOfferCandidate;
  enrichmentStatus: "COMPLETED" | "FALLBACK";
  aiUsage: {
    provider: "anthropic";
    model: string;
    inputTokens: number;
    outputTokens: number;
  } | null;
};

export function normalizeJobOffer(input: RawJobInput): JobOfferCandidate {
  return {
    id: randomUUID(),
    source: input.source,
    sourceJobId: input.source_job_id,
    normalizedUrl: normalizeUrl(input.url),
    title: input.title,
    company: input.company,
    jobFamily: "UNKNOWN",
    role: "UNKNOWN",
    country: null,
    city: null,
    modality: "UNKNOWN",
    distanceKm: null,
    contract: "UNKNOWN",
    employmentType: "UNKNOWN",
    workingHours: "UNKNOWN"
  };
}


export async function normalizeJobOfferWithAI(
  input: RawJobInput,
  enrichmentService: JobEnrichmentService
): Promise<NormalizedJobOfferResult> {
  const candidate = normalizeJobOffer(input);
  const enrichmentInput = buildJobEnrichmentInput(input);

  try {
    const result = await enrichmentService.enrich(enrichmentInput);

    return {
      candidate: mergeJobEnrichment(candidate, result.enrichment),
      enrichmentStatus: "COMPLETED",
      aiUsage: {
        provider: "anthropic",
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens
      }
    };
  } catch {
    return {
      candidate,
      enrichmentStatus: "FALLBACK",
      aiUsage: null
    };
  }
}