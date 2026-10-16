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

import { JobRequirementExtractionService } from "../../src/modules/jobs/requirement-extraction.service.js";

const input = {
  title: "Full Stack Developer",
  company: "Example",
  description:
    "Develop web applications with JavaScript and Node.js. English B2 required.",
  location: "Castellón de la Plana",
  source: "test",
  sourceJobId: "job-123",
  url: "https://example.com/jobs/job-123",
  metadata: {
    remote: true,
    working_hours: "full_time"
  }
};

describe("JobRequirementExtractionService", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("devuelve los requisitos estructurados y el uso de tokens", async () => {
    createMock.mockResolvedValue({
      parsed_output: {
        requirements: [
          {
            category: "technology",
            type: "group",
            importance: "required",
            data: {
              components: [
                { technology: "javascript" },
                { technology: "nodejs" }
              ]
            }
          },
          {
            category: "language",
            type: "single",
            importance: "required",
            data: {
              language: "english",
              minimumLevel: "B2"
            }
          }
        ]
      },
      usage: {
        input_tokens: 180,
        output_tokens: 120
      },
      model: "claude-haiku-4-5"
    });

    const service = new JobRequirementExtractionService("test-api-key");

    const result = await service.extract(input);

    expect(result).toEqual({
      result: {
        requirements: [
          {
            category: "technology",
            type: "group",
            importance: "required",
            data: {
              components: [
                { technology: "javascript" },
                { technology: "nodejs" }
              ]
            }
          },
          {
            category: "language",
            type: "single",
            importance: "required",
            data: {
              language: "english",
              minimumLevel: "B2"
            }
          }
        ]
      },
      inputTokens: 180,
      outputTokens: 120,
      model: "claude-haiku-4-5",
      promptVersion: "1.0.0"
    });

    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("acepta una extracción sin requisitos", async () => {
    createMock.mockResolvedValue({
      parsed_output: {
        requirements: []
      },
      usage: {
        input_tokens: 100,
        output_tokens: 20
      },
      model: "claude-haiku-4-5"
    });

    const service = new JobRequirementExtractionService("test-api-key");

    const result = await service.extract(input);

    expect(result.result).toEqual({
      requirements: []
    });
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

    const service = new JobRequirementExtractionService("test-api-key");

    await expect(service.extract(input)).rejects.toThrow(
      "Claude no devolvió un resultado válido de extracción de requisitos"
    );
  });
});