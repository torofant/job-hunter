
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

const usage = {
  input_tokens: 180,
  output_tokens: 120
};

describe("JobRequirementExtractionService", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("convierte la respuesta plana de Claude al contrato interno", async () => {
    createMock.mockResolvedValue({
      parsed_output: {
        requirements: [
          {
            category: "technology",
            type: "group",
            importance: "required",
            items: [
              {
                value: "javascript",
                targetType: null,
                minimumYears: null,
                minimumLevel: null
              },
              {
                value: "nodejs",
                targetType: null,
                minimumYears: null,
                minimumLevel: null
              }
            ]
          },
          {
            category: "experience",
            type: "single",
            importance: "required",
            items: [
              {
                value: "backend development",
                targetType: "area",
                minimumYears: 3,
                minimumLevel: null
              }
            ]
          },
          {
            category: "language",
            type: "single",
            importance: "preferred",
            items: [
              {
                value: "english",
                targetType: null,
                minimumYears: null,
                minimumLevel: "B2"
              }
            ]
          }
        ]
      },
      usage,
      model: "claude-haiku-4-5"
    });

    const service = new JobRequirementExtractionService("test-api-key");

    const result = await service.extract(input);

    expect(result.result).toEqual({
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
          category: "experience",
          type: "single",
          importance: "required",
          data: {
            target: {
              type: "area",
              value: "backend development"
            },
            minimumYears: 3
          }
        },
        {
          category: "language",
          type: "single",
          importance: "preferred",
          data: {
            language: "english",
            minimumLevel: "B2"
          }
        }
      ]
    });

    expect(result).toMatchObject({
      inputTokens: 180,
      outputTokens: 120,
      model: "claude-haiku-4-5",
      promptVersion: "1.4.0"
    });

    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("convierte alternativas y grupos conservando su semántica", async () => {
    createMock.mockResolvedValue({
      parsed_output: {
        requirements: [
          {
            category: "technology",
            type: "alternative",
            importance: "required",
            items: [
              {
                value: "javascript",
                targetType: null,
                minimumYears: null,
                minimumLevel: null
              },
              {
                value: "typescript",
                targetType: null,
                minimumYears: null,
                minimumLevel: null
              }
            ]
          },
          {
            category: "experience",
            type: "alternative",
            importance: "preferred",
            items: [
              {
                value: "backend development",
                targetType: "area",
                minimumYears: 3,
                minimumLevel: null
              },
              {
                value: "frontend development",
                targetType: "area",
                minimumYears: 2,
                minimumLevel: null
              }
            ]
          },
          {
            category: "language",
            type: "group",
            importance: "required",
            items: [
              {
                value: "english",
                targetType: null,
                minimumYears: null,
                minimumLevel: "B2"
              },
              {
                value: "spanish",
                targetType: null,
                minimumYears: null,
                minimumLevel: "C1"
              }
            ]
          }
        ]
      },
      usage,
      model: "claude-haiku-4-5"
    });

    const service = new JobRequirementExtractionService("test-api-key");
    const result = await service.extract(input);

    expect(result.result.requirements).toEqual([
      {
        category: "technology",
        type: "alternative",
        importance: "required",
        data: {
          options: [
            { technology: "javascript" },
            { technology: "typescript" }
          ]
        }
      },
      {
        category: "experience",
        type: "alternative",
        importance: "preferred",
        data: {
          options: [
            {
              target: { type: "area", value: "backend development" },
              minimumYears: 3
            },
            {
              target: { type: "area", value: "frontend development" },
              minimumYears: 2
            }
          ]
        }
      },
      {
        category: "language",
        type: "group",
        importance: "required",
        data: {
          components: [
            { language: "english", minimumLevel: "B2" },
            { language: "spanish", minimumLevel: "C1" }
          ]
        }
      }
    ]);
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

  it("rechaza experiencia sin años mínimos", async () => {
    createMock.mockResolvedValue({
      parsed_output: {
        requirements: [
          {
            category: "experience",
            type: "single",
            importance: "required",
            items: [
              {
                value: "backend development",
                targetType: "area",
                minimumYears: null,
                minimumLevel: null
              }
            ]
          }
        ]
      },
      usage,
      model: "claude-haiku-4-5"
    });

    const service = new JobRequirementExtractionService("test-api-key");

    await expect(service.extract(input)).rejects.toThrow(
      "datos incompletos o incompatibles"
    );
  });

  it("rechaza idiomas sin nivel CEFR", async () => {
    createMock.mockResolvedValue({
      parsed_output: {
        requirements: [
          {
            category: "language",
            type: "single",
            importance: "required",
            items: [
              {
                value: "english",
                targetType: null,
                minimumYears: null,
                minimumLevel: null
              }
            ]
          }
        ]
      },
      usage,
      model: "claude-haiku-4-5"
    });

    const service = new JobRequirementExtractionService("test-api-key");

    await expect(service.extract(input)).rejects.toThrow(
      "datos incompletos o incompatibles"
    );
  });

  it("rechaza requisitos single con más de un elemento", async () => {
    createMock.mockResolvedValue({
      parsed_output: {
        requirements: [
          {
            category: "technology",
            type: "single",
            importance: "required",
            items: [
              {
                value: "javascript",
                targetType: null,
                minimumYears: null,
                minimumLevel: null
              },
              {
                value: "typescript",
                targetType: null,
                minimumYears: null,
                minimumLevel: null
              }
            ]
          }
        ]
      },
      usage,
      model: "claude-haiku-4-5"
    });

    const service = new JobRequirementExtractionService("test-api-key");

    await expect(service.extract(input)).rejects.toThrow(
      "elementos para un requisito single"
    );
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

  it("normaliza expresiones de nivel y omite las no reconocidas", async () => {
    const cases = [
      { language: "spanish", minimumLevel: "nativo o bilingüe" },
      { language: "english", minimumLevel: "nivel alto" },
      { language: "english", minimumLevel: "intermedio" },
      { language: "english", minimumLevel: "básico" },
      { language: "english", minimumLevel: "C1" },
      { language: "english", minimumLevel: "fluido" }
    ];

    createMock.mockResolvedValue({
      parsed_output: {
        requirements: cases.map(({ language, minimumLevel }) => ({
          category: "language",
          type: "single",
          importance: "preferred",
          items: [
            {
              value: language,
              targetType: null,
              minimumYears: null,
              minimumLevel
            }
          ]
        }))
      },
      usage,
      model: "claude-haiku-4-5"
    });

    const service = new JobRequirementExtractionService("test-api-key");
    const result = await service.extract(input);

    const levels = result.result.requirements.map((requirement) => {
      if (requirement.category !== "language" || requirement.type !== "single") {
        throw new Error("Se esperaba un requisito simple de idioma");
      }

      return requirement.data.minimumLevel;
    });

    expect(levels).toEqual(["C2", "B2", "B1", "A2", "C1"]);
  });

  it("conserva el requisito de una nube y la preferencia por ambas", async () => {
    const cloudOptions = [
      {
        value: "aws",
        targetType: null,
        minimumYears: null,
        minimumLevel: null
      },
      {
        value: "google cloud",
        targetType: null,
        minimumYears: null,
        minimumLevel: null
      }
    ];

    createMock.mockResolvedValue({
      parsed_output: {
        requirements: [
          {
            category: "technology",
            type: "alternative",
            importance: "required",
            items: cloudOptions
          },
          {
            category: "technology",
            type: "group",
            importance: "preferred",
            items: cloudOptions
          }
        ]
      },
      usage,
      model: "claude-haiku-4-5"
    });

    const service = new JobRequirementExtractionService("test-api-key");
    const result = await service.extract(input);

    expect(result.result.requirements).toEqual([
      {
        category: "technology",
        type: "alternative",
        importance: "required",
        data: {
          options: [
            { technology: "aws" },
            { technology: "google cloud" }
          ]
        }
      },
      {
        category: "technology",
        type: "group",
        importance: "preferred",
        data: {
          components: [
            { technology: "aws" },
            { technology: "google cloud" }
          ]
        }
      }
    ]);
  });
});
