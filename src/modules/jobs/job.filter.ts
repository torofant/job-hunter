import type { InferSelectModel } from "drizzle-orm";
import { jobOffers } from "../../database/schema/job-offers.js";
import { getCityProvince } from "./job-location.js";

type JobOffer = InferSelectModel<typeof jobOffers>;

export type FilterStatus = "ACCEPTED" | "REJECTED";

export type FilterReason =
  | "INTERNSHIP"
  | "SCHOLARSHIP"
  | "TRAINEE"
  | "TEMPORARY_CONTRACT"
  | "IRRELEVANT_JOB_FAMILY"
  | "HARDWARE_SUPPORT"
  | "ONSITE_TOO_FAR";

export type JobFilterResult = {
  status: FilterStatus;
  reasons: FilterReason[];
};

export function filterJobOffer(jobOffer: JobOffer): JobFilterResult {
  const reasons: FilterReason[] = [];

  if (jobOffer.employmentType === "INTERNSHIP") {
    reasons.push("INTERNSHIP");
  }

  if (jobOffer.employmentType === "SCHOLARSHIP") {
    reasons.push("SCHOLARSHIP");
  }

  if (jobOffer.employmentType === "TRAINEE") {
    reasons.push("TRAINEE");
  }

  if (jobOffer.contract === "TEMPORARY") {
    reasons.push("TEMPORARY_CONTRACT");
  }

  if (jobOffer.jobFamily === "OTHER") {
    reasons.push("IRRELEVANT_JOB_FAMILY");
  }

  if (jobOffer.role === "HARDWARE_TECHNICIAN") {
    reasons.push("HARDWARE_SUPPORT");
  }

  if (jobOffer.modality === "ONSITE") {
    const province = getCityProvince(jobOffer.city);

    if (province === "OTHER") {
      reasons.push("ONSITE_TOO_FAR");
    }
  }

  return {
    status: reasons.length === 0 ? "ACCEPTED" : "REJECTED",
    reasons,
  };
}