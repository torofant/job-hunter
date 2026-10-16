import { describe, expect, it } from "vitest";

import {
  requirementExtractionResultSchema
} from "../../src/modules/jobs/requirement-extraction.js";

describe("requirementExtractionResultSchema", () => {
  it("acepta una extracción vacía", () => {
    const result = requirementExtractionResultSchema.safeParse({
      requirements: []
    });

    expect(result.success).toBe(true);
  });

  it("acepta una tecnología", () => {
    const result = requirementExtractionResultSchema.safeParse({
      requirements: [
        {
          category: "technology",
          type: "single",
          importance: "required",
          data: {
            technology: "javascript"
          }
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("acepta experiencia con años mínimos", () => {
    const result = requirementExtractionResultSchema.safeParse({
      requirements: [
        {
          category: "experience",
          type: "single",
          importance: "required",
          data: {
            target: {
              type: "technology",
              value: "javascript"
            },
            minimumYears: 2
          }
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("acepta idioma con nivel CEFR", () => {
    const result = requirementExtractionResultSchema.safeParse({
      requirements: [
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

    expect(result.success).toBe(true);
  });

  it("acepta una alternativa", () => {
    const result = requirementExtractionResultSchema.safeParse({
      requirements: [
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
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rechaza alternative con una sola opción", () => {
    const result = requirementExtractionResultSchema.safeParse({
      requirements: [
        {
          category: "technology",
          type: "alternative",
          importance: "required",
          data: {
            options: [
              { technology: "javascript" }
            ]
          }
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("rechaza requisitos other", () => {
    const result = requirementExtractionResultSchema.safeParse({
      requirements: [
        {
          category: "other",
          type: "single",
          importance: "required",
          data: {
            description: "carnet de conducir"
          }
        }
      ]
    });

    expect(result.success).toBe(false);
  });

  it("rechaza lenguaje sin nivel CEFR", () => {
    const result = requirementExtractionResultSchema.safeParse({
      requirements: [
        {
          category: "language",
          type: "single",
          importance: "required",
          data: {
            language: "english",
            minimumLevel: "advanced"
          }
        }
      ]
    });

    expect(result.success).toBe(false);
  });
});