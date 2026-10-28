import { describe, expect, it } from "vitest";

import {
  buildNotificationMessage,
  formatSalaryMetadata
} from "../../src/modules/notifications/notification-message.js";

describe("buildNotificationMessage", () => {
  it("construye un mensaje completo con los datos disponibles", () => {
    const result = buildNotificationMessage({
      title: "Backend Developer",
      company: "Example",
      city: "Castellón",
      country: "Spain",
      modality: "REMOTE",
      salary: "24.000–30.000 EUR/año",
      score: 82,
      category: "HIGH_MATCH",
      coverage: 91,
      url: "https://example.com/jobs/1"
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.message).toContain("Backend Developer — Example");
    expect(result.message).toContain("Castellón, Spain · REMOTE");
    expect(result.message).toContain("24.000–30.000 EUR/año");
    expect(result.message).toContain("82/100 · HIGH MATCH");
    expect(result.message).toContain("Cobertura: 91%");
    expect(result.message).toContain("https://example.com/jobs/1");
    expect(result.message).not.toContain("Confidence");
  });

  it("omite campos opcionales ausentes", () => {
    const result = buildNotificationMessage({
      title: "Developer",
      company: null,
      city: null,
      country: null,
      modality: null,
      salary: null,
      score: null,
      category: null,
      coverage: null,
      url: "https://example.com/jobs/2"
    });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.message).toContain("Developer");
    expect(result.message).toContain("https://example.com/jobs/2");
    expect(result.message).not.toContain("💰");
    expect(result.message).not.toContain("🎯");
    expect(result.message).not.toContain("📊");
  });

  it.each([
    null,
    "",
    "not-a-url",
    "ftp://example.com/jobs/3",
    "javascript:alert(1)"
  ])("rechaza una URL no utilizable: %s", (url) => {
    const result = buildNotificationMessage({
      title: "Developer",
      company: "Example",
      city: null,
      country: null,
      modality: null,
      salary: null,
      score: 70,
      category: "GOOD_MATCH",
      coverage: 80,
      url
    });

    expect(result).toEqual({
      ok: false,
      reason: "URL ausente o no utilizable (se requiere HTTP o HTTPS)"
    });
  });

  it("permite mostrar el Score sin clasificación", () => {
    const result = buildNotificationMessage({
      title: "Developer",
      company: null,
      city: null,
      country: null,
      modality: null,
      salary: null,
      score: 72.4,
      category: null,
      coverage: null,
      url: "https://example.com/jobs/4"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.message).toContain("72/100");
      expect(result.message).not.toContain("GOOD MATCH");
    }
  });
});
describe("formatSalaryMetadata", () => {
  it("formatea un salario con moneda y periodicidad disponibles", () => {
    expect(
      formatSalaryMetadata({
        salary: 25000,
        salary_currency: "EUR",
        salary_period: "annual"
      })
    ).toBe("25000 EUR/annual");
  });

  it("formatea un rango salarial", () => {
    expect(
      formatSalaryMetadata({
        salary_min: 24000,
        salary_max: 30000,
        salary_currency: "EUR",
        salary_period: "annual"
      })
    ).toBe("24000–30000 EUR/annual");
  });

  it("no inventa moneda ni periodicidad ausentes", () => {
    expect(formatSalaryMetadata({ salary: 25000 })).toBe("25000");
  });

  it("permite un rango con un solo límite", () => {
    expect(formatSalaryMetadata({ salary_min: 24000 })).toBe("24000");
  });

  it("devuelve null si no hay salario utilizable", () => {
    expect(formatSalaryMetadata(null)).toBeNull();
    expect(formatSalaryMetadata({})).toBeNull();
    expect(formatSalaryMetadata({ salary: Number.NaN })).toBeNull();
  });
});