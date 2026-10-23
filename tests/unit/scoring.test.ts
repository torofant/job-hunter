
import { describe, expect, it } from "vitest";
import {
  scoringBreakdownSchema,
  scoringCategorySchema,
  scoringResultSchema,
  matchingResultToScore,
  calculateWeightedScore,
  classifyScore,
  calculateWeightedContribution,
  calculateScoringResult,
  ScoringInputs
} from "../../src/modules/jobs/scoring";

describe("scoring schemas", () => {
  it("acepta las categorías de scoring definidas", () => {
    expect(scoringCategorySchema.parse("HIGH_MATCH")).toBe(
      "HIGH_MATCH"
    );
    expect(scoringCategorySchema.parse("GOOD_MATCH")).toBe(
      "GOOD_MATCH"
    );
    expect(scoringCategorySchema.parse("POSSIBLE_MATCH")).toBe(
      "POSSIBLE_MATCH"
    );
    expect(scoringCategorySchema.parse("LOW_MATCH")).toBe(
      "LOW_MATCH"
    );
  });

  it("rechaza categorías desconocidas", () => {
    expect(() => scoringCategorySchema.parse("REJECT")).toThrow();
  });

  it("acepta categorías sin evaluar mediante null", () => {
    const breakdown = {
      jobType: null,
      technologies: 20,
      experience: null,
      location: 12,
      employmentConditions: null,
      languages: 4,
      otherRequirements: null
    };

    expect(scoringBreakdownSchema.parse(breakdown)).toEqual(
      breakdown
    );
  });

  it("rechaza puntuaciones fuera del rango de cada categoría", () => {
    expect(() =>
      scoringBreakdownSchema.parse({
        jobType: 21,
        technologies: 25,
        experience: 20,
        location: 15,
        employmentConditions: 10,
        languages: 5,
        otherRequirements: 5
      })
    ).toThrow();
  });

  it("acepta un resultado sin puntuación calculable", () => {
    const result = {
      score: null,
      category: null,
      breakdown: {
        jobType: null,
        technologies: null,
        experience: null,
        location: null,
        employmentConditions: null,
        languages: null,
        otherRequirements: null
      }
    };

    expect(scoringResultSchema.parse(result)).toEqual(result);
  });

  it("rechaza puntuaciones totales fuera de 0–100", () => {
    const result = {
      score: 101,
      category: "HIGH_MATCH",
      breakdown: {
        jobType: 20,
        technologies: 25,
        experience: 20,
        location: 15,
        employmentConditions: 10,
        languages: 5,
        otherRequirements: 5
      }
    };

    expect(() => scoringResultSchema.parse(result)).toThrow();
  });
});

describe("matchingResultToScore", () => {
  it.each([
    ["MATCH", 1],
    ["PARTIAL", 0.7],
    ["MISSING", 0],
    ["UNKNOWN", null],
    ["N/A", null]
  ] as const)(
    "convierte %s en %s",
    (result, expected) => {
      expect(matchingResultToScore(result)).toBe(expected);
    }
  );
});


describe("calculateWeightedScore", () => {
  it("calcula el score ponderado con resultados evaluables", () => {
    expect(
      calculateWeightedScore([
        { weight: 20, result: "MATCH" },
        { weight: 10, result: "PARTIAL" },
        { weight: 5, result: "MISSING" }
      ])
    ).toBeCloseTo(77.142857);
  });

  it("renormaliza los pesos cuando hay resultados UNKNOWN", () => {
    expect(
      calculateWeightedScore([
        { weight: 20, result: "MATCH" },
        { weight: 10, result: "UNKNOWN" }
      ])
    ).toBe(100);
  });

  it("excluye los resultados N/A del denominador", () => {
    expect(
      calculateWeightedScore([
        { weight: 20, result: "PARTIAL" },
        { weight: 10, result: "N/A" }
      ])
    ).toBe(70);
  });

  it("devuelve null si no hay resultados evaluables", () => {
    expect(
      calculateWeightedScore([
        { weight: 20, result: "UNKNOWN" },
        { weight: 10, result: "N/A" }
      ])
    ).toBeNull();
  });

  it("devuelve cero si todos los resultados evaluables son MISSING", () => {
    expect(
      calculateWeightedScore([
        { weight: 20, result: "MISSING" },
        { weight: 10, result: "UNKNOWN" }
      ])
    ).toBe(0);
  });
});

describe("classifyScore", () => {
  it.each([
    [100, "HIGH_MATCH"],
    [80, "HIGH_MATCH"],
    [79, "GOOD_MATCH"],
    [65, "GOOD_MATCH"],
    [64, "POSSIBLE_MATCH"],
    [50, "POSSIBLE_MATCH"],
    [49, "LOW_MATCH"],
    [0, "LOW_MATCH"],
    [null, null]
  ] as const)(
    "clasifica el score %s como %s",
    (score, expected) => {
      expect(classifyScore(score)).toBe(expected);
    }
  );
});

describe("calculateWeightedContribution", () => {
  it("calcula la contribución usando el peso original", () => {
    expect(
      calculateWeightedContribution(
        [
          { weight: 1, result: "MATCH" },
          { weight: 1, result: "PARTIAL" }
        ],
        8
      )
    ).toBeCloseTo(6.8);
  });

  it("excluye resultados UNKNOWN y N/A del promedio", () => {
    expect(
      calculateWeightedContribution(
        [
          { weight: 1, result: "MATCH" },
          { weight: 1, result: "UNKNOWN" },
          { weight: 1, result: "N/A" }
        ],
        8
      )
    ).toBe(8);
  });

  it("devuelve cero cuando todos los resultados evaluables son MISSING", () => {
    expect(
      calculateWeightedContribution(
        [
          { weight: 1, result: "MISSING" },
          { weight: 1, result: "UNKNOWN" }
        ],
        8
      )
    ).toBe(0);
  });

  it("devuelve null si no hay resultados evaluables", () => {
    expect(
      calculateWeightedContribution(
        [
          { weight: 1, result: "UNKNOWN" },
          { weight: 1, result: "N/A" }
        ],
        8
      )
    ).toBeNull();
  });

  it("devuelve null si la lista está vacía", () => {
    expect(calculateWeightedContribution([], 8)).toBeNull();
  });
});

describe("calculateScoringResult", () => {
  const emptyInputs: ScoringInputs = {
    jobType: {
      family: "UNKNOWN",
      role: "UNKNOWN"
    },
    technologies: {
      required: [],
      preferred: []
    },
    experience: {
      general: [],
      specific: []
    },
    location: {
      modality: "UNKNOWN",
      locality: "UNKNOWN"
    },
    employmentConditions: {
      salary: "UNKNOWN",
      contract: "UNKNOWN",
      workingHours: "UNKNOWN"
    },
    languages: [],
    otherRequirements: []
  };

  it("devuelve null para score y categoría si nada es evaluable", () => {
    const result = calculateScoringResult(emptyInputs);

    expect(result.score).toBeNull();
    expect(result.category).toBeNull();
    expect(result.breakdown).toEqual({
      jobType: null,
      technologies: null,
      experience: null,
      location: null,
      employmentConditions: null,
      languages: null,
      otherRequirements: null
    });
  });

  it("renormaliza el score global según los pesos evaluables", () => {
    const result = calculateScoringResult({
      ...emptyInputs,
      jobType: {
        family: "MATCH",
        role: "UNKNOWN"
      }
    });

    expect(result.score).toBe(100);
    expect(result.category).toBe("HIGH_MATCH");
    expect(result.breakdown.jobType).toBe(8);
  });

  it("mantiene el subpeso de familia y rol en el desglose", () => {
    const result = calculateScoringResult({
      ...emptyInputs,
      jobType: {
        family: "MATCH",
        role: "MISSING"
      }
    });

    expect(result.score).toBe(40);
    expect(result.breakdown.jobType).toBe(8);
  });

  it("calcula por separado tecnologías requeridas y preferidas", () => {
    const result = calculateScoringResult({
      ...emptyInputs,
      technologies: {
        required: ["MATCH"],
        preferred: ["MISSING"]
      }
    });

    expect(result.score).toBe(70);
    expect(result.breakdown.technologies).toBe(17.5);
  });

  it("conserva los pesos originales del breakdown en las siete categorías", () => {
    const result = calculateScoringResult({
      ...emptyInputs,
      jobType: {
        family: "MATCH",
        role: "UNKNOWN"
      },
      technologies: {
        required: ["MATCH", "UNKNOWN"],
        preferred: []
      },
      experience: {
        general: ["MATCH", "N/A"],
        specific: []
      },
      location: {
        modality: "MATCH",
        locality: "UNKNOWN"
      },
      employmentConditions: {
        salary: "MATCH",
        contract: "UNKNOWN",
        workingHours: "N/A"
      },
      languages: ["MATCH", "UNKNOWN"],
      otherRequirements: ["MATCH", "N/A"]
    });

    expect(result.breakdown).toEqual({
      jobType: 8,
      technologies: 8.75,
      experience: 5,
      location: 10,
      employmentConditions: 5,
      languages: 2.5,
      otherRequirements: 2.5
    });

    expect(result.score).toBe(100);
  });

  it("aplica la puntuación numérica de localidad sin alterar su peso", () => {
    const result = calculateScoringResult({
      ...emptyInputs,
      location: {
        modality: "MATCH",
        locality: "MATCH",
        localityPoints: 4
      }
    });

    expect(result.breakdown.location).toBeCloseTo(14);
    expect(result.score).toBeCloseTo(93.3333, 3);
  });

  it("mantiene una contribución de cero para localidad con cero puntos", () => {
    const result = calculateScoringResult({
      ...emptyInputs,
      location: {
        modality: "MATCH",
        locality: "MISSING",
        localityPoints: 0
      }
    });

    expect(result.breakdown.location).toBe(10);
    expect(result.score).toBeCloseTo(66.6667, 3);
  });

  it("excluye la localidad desconocida del denominador", () => {
    const result = calculateScoringResult({
      ...emptyInputs,
      location: {
        modality: "MATCH",
        locality: "UNKNOWN",
        localityPoints: null
      }
    });

    expect(result.breakdown.location).toBe(10);
    expect(result.score).toBe(100);
  });

});