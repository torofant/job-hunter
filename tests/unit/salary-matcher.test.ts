import { describe, expect, it } from "vitest";
import { matchSalary } from "../../src/modules/jobs/salary-matcher.js";
import type { UserProfile } from "../../src/modules/jobs/user-profile.js";

const preferences = {
  currency: "EUR",
  minimum: 20000,
  desired: 24000
} as UserProfile["salaryPreferences"];

const validMetadata = {
  salary_currency: "EUR",
  salary_period: "annual"
};

describe("matchSalary", () => {
  it("devuelve UNKNOWN cuando faltan metadatos", () => {
    expect(matchSalary(null, preferences)).toBe("UNKNOWN");
  });

  it("devuelve MISSING por debajo del mínimo", () => {
    expect(
      matchSalary(
        { ...validMetadata, salary: 19999 },
        preferences
      )
    ).toBe("MISSING");
  });

  it("devuelve PARTIAL entre el mínimo y el objetivo", () => {
    expect(
      matchSalary(
        { ...validMetadata, salary: 22000 },
        preferences
      )
    ).toBe("PARTIAL");
  });

  it("devuelve MATCH al alcanzar el objetivo", () => {
    expect(
      matchSalary(
        { ...validMetadata, salary: 24000 },
        preferences
      )
    ).toBe("MATCH");
  });

  it("evalúa el mínimo de un rango salarial", () => {
    expect(
      matchSalary(
        {
          ...validMetadata,
          salary_min: 20000,
          salary_max: 26000
        },
        preferences
      )
    ).toBe("PARTIAL");
  });

  it("devuelve UNKNOWN si el rango no tiene mínimo", () => {
    expect(
      matchSalary(
        {
          ...validMetadata,
          salary_max: 26000
        },
        preferences
      )
    ).toBe("UNKNOWN");
  });

  it("devuelve UNKNOWN si no conoce la moneda", () => {
    expect(
      matchSalary(
        { salary: 30000, salary_period: "annual" },
        preferences
      )
    ).toBe("UNKNOWN");
  });

  it("devuelve UNKNOWN si no conoce la periodicidad", () => {
    expect(
      matchSalary(
        { salary: 30000, salary_currency: "EUR" },
        preferences
      )
    ).toBe("UNKNOWN");
  });

  it("devuelve UNKNOWN para importes ambiguos", () => {
    expect(
      matchSalary(
        { ...validMetadata, salary: "24.000 €" },
        preferences
      )
    ).toBe("UNKNOWN");
  });

  it("devuelve UNKNOWN cuando la moneda no es compatible", () => {
    expect(
      matchSalary(
        {
          salary: 30000,
          salary_currency: "USD",
          salary_period: "annual"
        },
        preferences
      )
    ).toBe("UNKNOWN");
  });

  it("devuelve UNKNOWN cuando la periodicidad no es anual", () => {
    expect(
      matchSalary(
        {
          ...validMetadata,
          salary: 2500,
          salary_period: "monthly"
        },
        preferences
      )
    ).toBe("UNKNOWN");
  });
});