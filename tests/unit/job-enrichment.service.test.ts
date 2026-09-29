import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn()
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = {
      parse: createMock
    };
  }
}));

import { JobEnrichmentService } from "../../src/modules/jobs/job-enrichment.service.js";

const input = {
  title: "Full Stack Developer",
  company: "Example",
  description: "Develop web applications with JavaScript and Node.js.",
  location: "Castellón de la Plana",
  source: "test",
  sourceJobId: "job-123",
  url: "https://example.com/jobs/job-123",
  metadata: {
    remote: true,
    working_hours: "full_time"
  }
};

describe("JobEnrichmentService", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("devuelve el enriquecimiento estructurado y el uso de tokens", async () => {
    createMock.mockResolvedValue({
      parsed_output: {
        jobFamily: "WEB",
        role: "FULL_STACK_DEVELOPER",
        country: "Spain",
        city: "Castellón de la Plana",
        modality: "REMOTE",
        contract: "PERMANENT",
        employmentType: "EMPLOYEE",
        workingHours: "FULL_TIME"
      },
      usage: {
        input_tokens: 120,
        output_tokens: 80
      },
      model: "claude-haiku-4-5"
    });

    const service = new JobEnrichmentService("test-api-key");

    const result = await service.enrich(input);

    expect(result).toEqual({
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
      inputTokens: 120,
      outputTokens: 80,
      model: "claude-haiku-4-5"
    });

    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("falla si Claude no devuelve parsed_output", async () => {
    createMock.mockResolvedValue({
      parsed_output: null,
      usage: {
        input_tokens: 100,
        output_tokens: 20
      },
      model: "claude-haiku-4-5"
    });

    const service = new JobEnrichmentService("test-api-key");

    await expect(service.enrich(input)).rejects.toThrow(
      "Claude did not return a structured enrichment"
    );
  });
});