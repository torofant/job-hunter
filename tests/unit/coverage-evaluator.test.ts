import { describe, expect, it } from "vitest";

import {
  evaluateCoverage,
  type CoverageEvaluationInput
} from "../../src/modules/jobs/coverage-evaluator.js";

describe("evaluateCoverage", () => {
  const baseInput: CoverageEvaluationInput = {
    jobFamily: "SOFTWARE",
    role: "BACKEND_DEVELOPER",
    country: "España",
    city: "Castellón",
    modality: "ONSITE",
    contract: "PERMANENT",
    employmentType: "EMPLOYEE",
    workingHours: "FULL_TIME",
    extractionStatus: "COMPLETED",
    requirements: []
  };

  it("asigna FULL a familia y rol cuando ambos son conocidos", () => {
    expect(evaluateCoverage(baseInput).job_type).toBe(100);
  });

  it("aplica el peso 40/60 cuando solo se conoce la familia", () => {
    expect(
      evaluateCoverage({
        ...baseInput,
        role: "UNKNOWN"
      }).job_type
    ).toBe(40);
  });

  it("no considera FULL una ubicación con campos incompletos", () => {
    expect(
      evaluateCoverage({
        ...baseInput,
        city: null
      }).location
    ).toBe(50);
  });

  it("asigna UNKNOWN si no hay datos de ubicación utilizables", () => {
    expect(
      evaluateCoverage({
        ...baseInput,
        country: null,
        city: null,
        modality: "UNKNOWN"
      }).location
    ).toBe(0);
  });

  it("asigna FULL a condiciones laborales si todos los campos están disponibles", () => {
    expect(
      evaluateCoverage(baseInput).employment_conditions
    ).toBe(100);
  });

  it("no interpreta una lista vacía como N/A", () => {
    const result = evaluateCoverage({
      ...baseInput,
      requirements: []
    });

    expect(result.technologies).toBe(0);
    expect(result.experience).toBe(0);
    expect(result.languages).toBe(0);
    expect(result.other_requirements).toBe(0);
  });

  it("no asigna FULL a una categoría con requisitos extraídos", () => {
    const result = evaluateCoverage({
      ...baseInput,
      requirements: [
        {
          category: "technology",
          type: "single",
          importance: "required",
          data: { technology: "TypeScript" }
        }
      ]
    });

    // Required LIMITED = 50, preferred UNKNOWN = 0.
    // 70 % * 50 + 30 % * 0 = 35.
    expect(result.technologies).toBe(35);
  });

  it("no confía en requisitos si la extracción ha fallado", () => {
    const result = evaluateCoverage({
      ...baseInput,
      extractionStatus: "FAILED",
      requirements: [
        {
          category: "technology",
          type: "single",
          importance: "required",
          data: { technology: "TypeScript" }
        }
      ]
    });

    expect(result.technologies).toBe(0);
  });

  it("no cambia Coverage en función de la adecuación del candidato", () => {
    const first = evaluateCoverage(baseInput);
    const second = evaluateCoverage({
      ...baseInput,
      requirements: []
    });

    expect(first.job_type).toBe(second.job_type);
    expect(first.location).toBe(second.location);
    expect(first.employment_conditions).toBe(
      second.employment_conditions
    );
  });
});
