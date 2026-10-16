import { describe, expect, it } from "vitest";
import {
  haveSameRequirementSet,
  normalizeAndDeduplicateRequirements,
  normalizeRequirement
} from "../../src/modules/jobs/requirement.normalizer.js";


describe("requirement normalizer", () => {
  it("normaliza aliases de tecnología", () => {
    const result = normalizeRequirement({
      category: "technology",
      type: "single",
      importance: "required",
      data: {
        technology: "Node.js"
      }
    });

    expect(result).toEqual({
      category: "technology",
      type: "single",
      importance: "required",
      data: {
        technology: "nodejs"
      }
    });
  });

  it("normaliza idiomas y elimina espacios", () => {
    const result = normalizeRequirement({
      category: "language",
      type: "single",
      importance: "required",
      data: {
        language: " Inglés ",
        minimumLevel: "B2"
      }
    });

    expect(result).toEqual({
      category: "language",
      type: "single",
      importance: "required",
      data: {
        language: "english",
        minimumLevel: "B2"
      }
    });
  });

  it("normaliza tecnología dentro de experiencia", () => {
    const result = normalizeRequirement({
      category: "experience",
      type: "single",
      importance: "required",
      data: {
        target: {
          type: "technology",
          value: "JS"
        },
        minimumYears: 2
      }
    });

    expect(result).toEqual({
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
  });

  it("ordena alternativas para obtener una identidad estable", () => {
    const result = normalizeRequirement({
      category: "technology",
      type: "alternative",
      importance: "required",
      data: {
        options: [
          { technology: "TypeScript" },
          { technology: "JavaScript" }
        ]
      }
    });

    expect(result).toEqual({
      category: "technology",
      type: "alternative",
      importance: "required",
      data: {
        options: [
          { technology: "javascript" },
          { technology: "typescript" }
        ]
      }
    });
  });

  it("elimina requisitos duplicados después de normalizar", () => {
    const result = normalizeAndDeduplicateRequirements([
      {
        category: "technology",
        type: "single",
        importance: "required",
        data: {
          technology: "JavaScript"
        }
      },
      {
        category: "technology",
        type: "single",
        importance: "required",
        data: {
          technology: "JS"
        }
      }
    ]);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      category: "technology",
      type: "single",
      importance: "required",
      data: {
        technology: "javascript"
      }
    });

    expect(result[0].id).toEqual(expect.any(String));
  });

  it("no considera duplicados requisitos con distinta importancia", () => {
    const result = normalizeAndDeduplicateRequirements([
      {
        category: "technology",
        type: "single",
        importance: "required",
        data: {
          technology: "JavaScript"
        }
      },
      {
        category: "technology",
        type: "single",
        importance: "preferred",
        data: {
          technology: "JavaScript"
        }
      }
    ]);

    expect(result).toHaveLength(2);
  });

  it("no elimina requisitos de experiencia con distintos años", () => {
    const result = normalizeAndDeduplicateRequirements([
      {
        category: "experience",
        type: "single",
        importance: "required",
        data: {
          target: {
            type: "technology",
            value: "JavaScript"
          },
          minimumYears: 2
        }
      },
      {
        category: "experience",
        type: "single",
        importance: "required",
        data: {
          target: {
            type: "technology",
            value: "JavaScript"
          },
          minimumYears: 3
        }
      }
    ]);

    expect(result).toHaveLength(2);
  });

  it("considera equivalentes alternativas con distinto orden", () => {
    const result = normalizeAndDeduplicateRequirements([
      {
        category: "technology",
        type: "alternative",
        importance: "required",
        data: {
          options: [
            { technology: "JavaScript" },
            { technology: "TypeScript" }
          ]
        }
      },
      {
        category: "technology",
        type: "alternative",
        importance: "required",
        data: {
          options: [
            { technology: "TypeScript" },
            { technology: "JavaScript" }
          ]
        }
      }
    ]);

    expect(result).toHaveLength(1);
  });

  it("considera iguales los conjuntos aunque cambien los IDs y el orden", () => {
    const first = normalizeAndDeduplicateRequirements([
      {
        category: "technology",
        type: "single",
        importance: "required",
        data: { technology: "JavaScript" }
      },
      {
        category: "language",
        type: "single",
        importance: "preferred",
        data: { language: "English", minimumLevel: "B2" }
      }
    ]);

    const second = [
      {
        ...first[1],
        id: "00000000-0000-4000-8000-000000000001"
      },
      {
        ...first[0],
        id: "00000000-0000-4000-8000-000000000002"
      }
    ];

    expect(haveSameRequirementSet(first, second)).toBe(true);
  });

  it("detecta cambios en la importancia o en los datos", () => {
    const first = normalizeAndDeduplicateRequirements([
      {
        category: "technology",
        type: "single",
        importance: "required",
        data: { technology: "JavaScript" }
      }
    ]);

    const differentImportance = normalizeAndDeduplicateRequirements([
      {
        category: "technology",
        type: "single",
        importance: "preferred",
        data: { technology: "JavaScript" }
      }
    ]);

    const differentTechnology = normalizeAndDeduplicateRequirements([
      {
        category: "technology",
        type: "single",
        importance: "required",
        data: { technology: "TypeScript" }
      }
    ]);

    expect(haveSameRequirementSet(first, differentImportance)).toBe(false);
    expect(haveSameRequirementSet(first, differentTechnology)).toBe(false);
  });

  it("detecta conjuntos con distinta cantidad de requisitos", () => {
    const first = normalizeAndDeduplicateRequirements([
      {
        category: "technology",
        type: "single",
        importance: "required",
        data: { technology: "JavaScript" }
      }
    ]);

    expect(haveSameRequirementSet(first, [])).toBe(false);
  });
});