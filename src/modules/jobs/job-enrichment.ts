import { z } from "zod";

export const jobEnrichmentSchema = z.object({
  jobFamily: z.enum([
    "WEB",
    "SOFTWARE",
    "AUTOMATION",
    "SYSTEMS",
    "SUPPORT",
    "OTHER",
    "UNKNOWN"
  ]),

  role: z.enum([
    "FULL_STACK_DEVELOPER",
    "FRONTEND_DEVELOPER",
    "BACKEND_DEVELOPER",
    "WEB_DEVELOPER",
    "SOFTWARE_DEVELOPER",
    "AUTOMATION_DEVELOPER",
    "INTEGRATION_DEVELOPER",
    "PROCESS_AUTOMATION_DEVELOPER",
    "SYSTEM_ADMINISTRATOR",
    "DEVOPS",
    "INFRASTRUCTURE_ENGINEER",
    "APPLICATION_SUPPORT",
    "TECHNICAL_SUPPORT",
    "TECHNICAL_CONSULTANT",
    "HARDWARE_TECHNICIAN",
    "OTHER",
    "UNKNOWN"
  ]),

  country: z.string().nullable(),

  city: z.string().nullable(),

  modality: z.enum([
    "REMOTE",
    "HYBRID",
    "ONSITE",
    "UNKNOWN"
  ]),

  contract: z.enum([
    "PERMANENT",
    "TEMPORARY",
    "UNKNOWN"
  ]),

  employmentType: z.enum([
    "EMPLOYEE",
    "FREELANCE",
    "SELF_EMPLOYED",
    "INTERNSHIP",
    "SCHOLARSHIP",
    "TRAINEE",
    "UNKNOWN"
  ]),

  workingHours: z.enum([
    "FULL_TIME",
    "PART_TIME",
    "UNKNOWN"
  ])
});

export type JobEnrichment = z.infer<typeof jobEnrichmentSchema>;

import type { JobOfferCandidate } from "./job.normalizer.js";

export function mergeJobEnrichment(
  candidate: JobOfferCandidate,
  enrichment: JobEnrichment
): JobOfferCandidate {
  return {
    ...candidate,

    jobFamily:
      enrichment.jobFamily === "UNKNOWN"
        ? candidate.jobFamily
        : enrichment.jobFamily,

    role:
      enrichment.role === "UNKNOWN"
        ? candidate.role
        : enrichment.role,

    country:
      enrichment.country === null
        ? candidate.country
        : enrichment.country,

    city:
      enrichment.city === null
        ? candidate.city
        : enrichment.city,

    modality:
      enrichment.modality === "UNKNOWN"
        ? candidate.modality
        : enrichment.modality,

    contract:
      enrichment.contract === "UNKNOWN"
        ? candidate.contract
        : enrichment.contract,

    employmentType:
      enrichment.employmentType === "UNKNOWN"
        ? candidate.employmentType
        : enrichment.employmentType,

    workingHours:
      enrichment.workingHours === "UNKNOWN"
        ? candidate.workingHours
        : enrichment.workingHours
  };
}