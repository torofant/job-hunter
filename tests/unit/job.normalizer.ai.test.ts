import { describe, expect, it, vi } from "vitest";

import { normalizeJobOfferWithAI } from "../../src/modules/jobs/job.normalizer.js";
import type { JobEnrichmentService } from "../../src/modules/jobs/job-enrichment.service.js";
import type { RawJobInput } from "../../src/api/schemas/raw-job-input.schema.js";

const input: RawJobInput = {
  source: "test",
  source_job_id: "job-123",
  title: "Full Stack Developer",
  company: "Example",
  url: "https://example.com/jobs/123",
  description: "Develop web applications with JavaScript and Node.js.",
  location: "Castellón de la Plana",
  detected_at: new Date(),
  raw_metadata: null
};

describe("normalizeJobOfferWithAI", () => {
  it("combina el candidato determinista con el enriquecimiento de Claude", async () => {
    const enrichmentService = {
      enrich: vi.fn().mockResolvedValue({
        enrichment: {
          jobFamily: "WEB",
          role: "FULL_STACK_DEVELOPER",
          country: "Spain",
          city: "Castellón de la Plana",
          modality: "REMOTE",
          contract: "PERMANENT",
          employmentType: "EMPLOYEE",
          workingHours: "FULL_TIME"
        },
        inputTokens: 100,
        outputTokens: 50,
        model: "claude-haiku-4-5"
      })
    } as unknown as JobEnrichmentService;

    const result = await normalizeJobOfferWithAI(
      input,
      enrichmentService
    );

    expect(result.enrichmentStatus).toBe("COMPLETED");
    expect(result.candidate.jobFamily).toBe("WEB");
    expect(result.candidate.role).toBe("FULL_STACK_DEVELOPER");
    expect(result.candidate.country).toBe("Spain");
    expect(result.candidate.city).toBe("Castellón de la Plana");
    expect(result.candidate.modality).toBe("REMOTE");
    expect(result.candidate.contract).toBe("PERMANENT");

    expect(result.aiUsage).toEqual({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      inputTokens: 100,
      outputTokens: 50
    });
  });

  it("conserva el candidato determinista si Claude falla", async () => {
    const enrichmentService = {
      enrich: vi
        .fn()
        .mockRejectedValue(new Error("Anthropic unavailable"))
    } as unknown as JobEnrichmentService;

    const result = await normalizeJobOfferWithAI(
      input,
      enrichmentService
    );

    expect(result.enrichmentStatus).toBe("FALLBACK");
    expect(result.candidate.title).toBe(input.title);
    expect(result.candidate.company).toBe(input.company);
    expect(result.candidate.source).toBe(input.source);
    expect(result.candidate.sourceJobId).toBe(input.source_job_id);
    expect(result.candidate.jobFamily).toBe("UNKNOWN");
    expect(result.candidate.role).toBe("UNKNOWN");
    expect(result.candidate.country).toBeNull();
    expect(result.candidate.city).toBeNull();
    expect(result.candidate.modality).toBe("UNKNOWN");
    expect(result.candidate.contract).toBe("UNKNOWN");
    expect(result.candidate.employmentType).toBe("UNKNOWN");
    expect(result.candidate.workingHours).toBe("UNKNOWN");
    expect(result.aiUsage).toBeNull();
  });

  it("llama a Claude una sola vez", async () => {
    const enrichmentService = {
      enrich: vi.fn().mockResolvedValue({
        enrichment: {
          jobFamily: "WEB",
          role: "WEB_DEVELOPER",
          country: "Spain",
          city: "Castellón de la Plana",
          modality: "REMOTE",
          contract: "PERMANENT",
          employmentType: "EMPLOYEE",
          workingHours: "FULL_TIME"
        },
        inputTokens: 100,
        outputTokens: 50,
        model: "claude-haiku-4-5"
      })
    } as unknown as JobEnrichmentService;

    await normalizeJobOfferWithAI(input, enrichmentService);

    expect(enrichmentService.enrich).toHaveBeenCalledTimes(1);
  });
});