import { describe, expect, it } from "vitest";

import { requirementSchema } from "../../src/modules/jobs/requirement.js";

describe("requirementSchema", () => {
  it("acepta un requisito tecnológico simple", () => {
    const result = requirementSchema.safeParse({
      category: "technology",
      type: "single",
      importance: "required",
      data: {
        technology: "javascript"
      }
    });

    expect(result.success).toBe(true);
  });

  it("acepta una alternativa tecnológica", () => {
    const result = requirementSchema.safeParse({
      category: "technology",
      type: "alternative",
      importance: "preferred",
      data: {
        options: [
          { technology: "javascript" },
          { technology: "typescript" }
        ]
      }
    });

    expect(result.success).toBe(true);
  });

  it("acepta un grupo de tecnologías", () => {
    const result = requirementSchema.safeParse({
      category: "technology",
      type: "group",
      importance: "required",
      data: {
        components: [
          { technology: "nodejs" },
          { technology: "postgresql" }
        ]
      }
    });

    expect(result.success).toBe(true);
  });

  it("acepta un requisito de experiencia", () => {
    const result = requirementSchema.safeParse({
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
    });

    expect(result.success).toBe(true);
  });

  it("acepta un requisito de idioma", () => {
    const result = requirementSchema.safeParse({
      category: "language",
      type: "single",
      importance: "required",
      data: {
        language: "english",
        minimumLevel: "B2"
      }
    });

    expect(result.success).toBe(true);
  });

  it("rechaza alternativas con menos de dos opciones", () => {
    const result = requirementSchema.safeParse({
      category: "technology",
      type: "alternative",
      importance: "required",
      data: {
        options: [
          { technology: "javascript" }
        ]
      }
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un requisito tecnológico con data de experiencia", () => {
    const result = requirementSchema.safeParse({
      category: "technology",
      type: "single",
      importance: "required",
      data: {
        target: {
          type: "technology",
          value: "javascript"
        },
        minimumYears: 2
      }
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un nivel de idioma que no pertenece a CEFR", () => {
    const result = requirementSchema.safeParse({
      category: "language",
      type: "single",
      importance: "required",
      data: {
        language: "english",
        minimumLevel: "advanced"
      }
    });

    expect(result.success).toBe(false);
  });

  it("rechaza la categoría other", () => {
    const result = requirementSchema.safeParse({
      category: "other",
      type: "single",
      importance: "required",
      data: {
        value: "carnet de conducir"
      }
    });

    expect(result.success).toBe(false);
  });
});