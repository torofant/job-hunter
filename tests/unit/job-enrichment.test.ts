import { describe, expect, it } from "vitest";

import {
  mergeJobEnrichment,
  type JobEnrichment
} from "../../src/modules/jobs/job-enrichment.js";
import type { JobOfferCandidate } from "../../src/modules/jobs/job.normalizer.js";

const candidate: JobOfferCandidate = {
  id: "job-1",
  source: "test",
  sourceJobId: "source-1",
  normalizedUrl: "https://example.com/jobs/1",
  title: "Developer",
  company: "Example",
  jobFamily: "UNKNOWN",
  role: "UNKNOWN",
  country: null,
  city: null,
  modality: "UNKNOWN",
  distanceKm: null,
  contract: "UNKNOWN",
  employmentType: "UNKNOWN",
  workingHours: "UNKNOWN"
};

const enrichment: JobEnrichment = {
  jobFamily: "WEB",
  role: "FULL_STACK_DEVELOPER",
  country: "Spain",
  city: "Castellón de la Plana",
  modality: "REMOTE",
  contract: "PERMANENT",
  employmentType: "EMPLOYEE",
  workingHours: "FULL_TIME"
};

describe("mergeJobEnrichment", () => {
  it("incorpora la información aportada por Claude", () => {
    const result = mergeJobEnrichment(candidate, enrichment);

    expect(result).toEqual({
      ...candidate,
      jobFamily: "WEB",
      role: "FULL_STACK_DEVELOPER",
      country: "Spain",
      city: "Castellón de la Plana",
      modality: "REMOTE",
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    });
  });

  it("conserva los valores deterministas cuando Claude devuelve UNKNOWN o null", () => {
    const deterministicCandidate: JobOfferCandidate = {
      ...candidate,
      jobFamily: "WEB",
      role: "WEB_DEVELOPER",
      country: "Spain",
      city: "Castellón de la Plana",
      modality: "HYBRID",
      contract: "PERMANENT",
      employmentType: "EMPLOYEE",
      workingHours: "FULL_TIME"
    };

    const unknownEnrichment: JobEnrichment = {
      jobFamily: "UNKNOWN",
      role: "UNKNOWN",
      country: null,
      city: null,
      modality: "UNKNOWN",
      contract: "UNKNOWN",
      employmentType: "UNKNOWN",
      workingHours: "UNKNOWN"
    };

    const result = mergeJobEnrichment(
      deterministicCandidate,
      unknownEnrichment
    );

    expect(result).toEqual(deterministicCandidate);
  });

  it("no modifica los campos controlados por la aplicación", () => {
    const result = mergeJobEnrichment(candidate, enrichment);

    expect(result.id).toBe(candidate.id);
    expect(result.source).toBe(candidate.source);
    expect(result.sourceJobId).toBe(candidate.sourceJobId);
    expect(result.normalizedUrl).toBe(candidate.normalizedUrl);
    expect(result.title).toBe(candidate.title);
    expect(result.company).toBe(candidate.company);
    expect(result.distanceKm).toBe(candidate.distanceKm);
  });
});