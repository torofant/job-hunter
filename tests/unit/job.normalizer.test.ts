import { describe, expect, it } from "vitest";

import {
  normalizeJobOffer,
  normalizeUrl
} from "../../src/modules/jobs/job.normalizer.js";

describe("normalizeUrl", () => {
  it("elimina espacios exteriores y normaliza el hostname", () => {
    expect(
      normalizeUrl("  HTTPS://Example.COM/jobs/123  ")
    ).toBe("https://example.com/jobs/123");
  });

  it("conserva path y query", () => {
    expect(
      normalizeUrl(
        "https://Example.COM/jobs/123?utm_source=test&ref=abc"
      )
    ).toBe(
      "https://example.com/jobs/123?utm_source=test&ref=abc"
    );
  });
});

describe("normalizeJobOffer", () => {
  it("crea un candidato JobOffer con los datos deterministas", () => {
    const result = normalizeJobOffer({
      source: "linkedin",
      source_job_id: "job-123",
      title: "Desarrollador Web",
      company: "Empresa X",
      url: " HTTPS://Example.COM/jobs/123 ",
      description: "Oferta de desarrollo web",
      location: "Castellón",
      detected_at: new Date("2026-09-25T10:00:00Z")
    });

    expect(result).toMatchObject({
      source: "linkedin",
      sourceJobId: "job-123",
      normalizedUrl: "https://example.com/jobs/123",
      title: "Desarrollador Web",
      company: "Empresa X",
      jobFamily: "UNKNOWN",
      role: "UNKNOWN",
      country: null,
      city: null,
      modality: "UNKNOWN",
      distanceKm: null,
      contract: "UNKNOWN",
      employmentType: "UNKNOWN",
      workingHours: "UNKNOWN"
    });

    expect(result.id).toEqual(expect.any(String));
  });

  it("mantiene UNKNOWN cuando no hay información estructurada suficiente", () => {
    const result = normalizeJobOffer({
      source: "linkedin",
      title: "Developer",
      company: "Empresa X",
      url: "https://example.com/jobs/123",
      location: "Valencia",
      detected_at: new Date("2026-09-25T10:00:00Z")
    });

    expect(result).toMatchObject({
      jobFamily: "UNKNOWN",
      role: "UNKNOWN",
      country: null,
      city: null,
      modality: "UNKNOWN",
      distanceKm: null,
      contract: "UNKNOWN",
      employmentType: "UNKNOWN",
      workingHours: "UNKNOWN"
    });
  });
});