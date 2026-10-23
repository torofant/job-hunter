
import { describe, expect, it } from "vitest";

import {
  calculateFamilyRoleCoverage,
  calculateGlobalCoverageScore,
  calculateRequirementCoverage,
  COVERAGE_CATEGORY_WEIGHTS,
  calculateCoverageBreakdown,
  calculateCoverageScore,
  coverageLevelToValue,
  type CoverageCategoryInput
} from "../../src/modules/jobs/coverage.js";

describe("coverageLevelToValue", () => {
  it.each([
    ["FULL", 100],
    ["LIMITED", 50],
    ["UNKNOWN", 0],
    ["N/A", null]
  ] as const)("convierte el nivel %s en %s", (level, expected) => {
    expect(coverageLevelToValue(level)).toBe(expected);
  });
});

describe("calculateCoverageScore", () => {
  it("calcula una media ponderada", () => {
    expect(
      calculateCoverageScore([
        { level: "FULL", weight: 40 },
        { level: "LIMITED", weight: 60 }
      ])
    ).toBe(70);
  });

  it("excluye N/A del numerador y del denominador", () => {
    expect(
      calculateCoverageScore([
        { level: "FULL", weight: 40 },
        { level: "N/A", weight: 60 }
      ])
    ).toBe(100);
  });

  it("devuelve cero cuando todas las categorías evaluables son UNKNOWN", () => {
    expect(
      calculateCoverageScore([
        { level: "UNKNOWN", weight: 40 },
        { level: "UNKNOWN", weight: 60 }
      ])
    ).toBe(0);
  });

  it("devuelve null cuando todas las categorías son N/A", () => {
    expect(
      calculateCoverageScore([
        { level: "N/A", weight: 40 },
        { level: "N/A", weight: 60 }
      ])
    ).toBeNull();
  });

  it("devuelve null cuando no hay pesos evaluables positivos", () => {
    expect(
      calculateCoverageScore([
        { level: "FULL", weight: 0 },
        { level: "LIMITED", weight: 0 }
      ])
    ).toBeNull();
  });
});

describe("calculateCoverageBreakdown", () => {
  it("calcula cada categoría de forma independiente", () => {
    const inputs: CoverageCategoryInput = {
      job_type: [{ level: "FULL", weight: 1 }],
      technologies: [{ level: "LIMITED", weight: 1 }],
      experience: [{ level: "UNKNOWN", weight: 1 }],
      location: [{ level: "N/A", weight: 1 }],
      employment_conditions: [{ level: "FULL", weight: 1 }],
      languages: [{ level: "LIMITED", weight: 1 }],
      other_requirements: [{ level: "FULL", weight: 1 }]
    };

    expect(calculateCoverageBreakdown(inputs)).toEqual({
      job_type: 100,
      technologies: 50,
      experience: 0,
      location: null,
      employment_conditions: 100,
      languages: 50,
      other_requirements: 100
    });
  });
});


describe("calculateFamilyRoleCoverage", () => {
  it("aplica los pesos 40/60 entre familia y rol", () => {
    expect(
      calculateFamilyRoleCoverage("FULL", "UNKNOWN")
    ).toBe(40);
  });

  it("renormaliza si familia es N/A", () => {
    expect(
      calculateFamilyRoleCoverage("N/A", "LIMITED")
    ).toBe(50);
  });
});

describe("calculateRequirementCoverage", () => {
  it("aplica los pesos 70/30 entre required y preferred", () => {
    expect(
      calculateRequirementCoverage(
        ["FULL"],
        ["UNKNOWN"]
      )
    ).toBe(70);
  });

  it("excluye requisitos N/A dentro de cada grupo", () => {
    expect(
      calculateRequirementCoverage(
        ["FULL", "N/A"],
        ["UNKNOWN"]
      )
    ).toBe(70);
  });

  it("renormaliza si no hay requisitos obligatorios evaluables", () => {
    expect(
      calculateRequirementCoverage(
        ["N/A"],
        ["LIMITED"]
      )
    ).toBe(50);
  });

  it("devuelve null si ningún grupo es evaluable", () => {
    expect(
      calculateRequirementCoverage(
        ["N/A"],
        []
      )
    ).toBeNull();
  });
});

describe("calculateGlobalCoverageScore", () => {
  it("combina las categorías usando sus pesos definidos", () => {
    const breakdown = {
      job_type: 100,
      technologies: 50,
      experience: 0,
      location: null,
      employment_conditions: 100,
      languages: 50,
      other_requirements: 100
    };

    const expected =
      (
        100 * 20 +
        50 * 25 +
        0 * 20 +
        100 * 10 +
        50 * 5 +
        100 * 5
      ) /
      (
        COVERAGE_CATEGORY_WEIGHTS.job_type +
        COVERAGE_CATEGORY_WEIGHTS.technologies +
        COVERAGE_CATEGORY_WEIGHTS.experience +
        COVERAGE_CATEGORY_WEIGHTS.employment_conditions +
        COVERAGE_CATEGORY_WEIGHTS.languages +
        COVERAGE_CATEGORY_WEIGHTS.other_requirements
      );

    expect(calculateGlobalCoverageScore(breakdown)).toBe(expected);
  });

  it("devuelve null cuando todas las categorías son null", () => {
    const breakdown = {
      job_type: null,
      technologies: null,
      experience: null,
      location: null,
      employment_conditions: null,
      languages: null,
      other_requirements: null
    };

    expect(calculateGlobalCoverageScore(breakdown)).toBeNull();
  });
});
