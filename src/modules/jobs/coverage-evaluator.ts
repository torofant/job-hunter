
import {
  calculateCoverageScore,
  calculateFamilyRoleCoverage,
  calculateRequirementCoverage,
  type CoverageBreakdown,
  type CoverageLevel
} from "./coverage.js";

import type { ExtractedRequirement } from "./requirement-extraction.js";

export type CoverageEvaluationInput = {
  jobFamily: string;
  role: string;
  country: string | null;
  city: string | null;
  modality: string;
  contract: string;
  employmentType: string;
  workingHours: string;
  extractionStatus: "COMPLETED" | "FAILED";
  requirements: ExtractedRequirement[];
};

function isKnownValue(value: string | null | undefined): boolean {
  return (
    value !== null &&
    value !== undefined &&
    value.trim() !== "" &&
    value !== "UNKNOWN"
  );
}

/**
 * Clasifica la disponibilidad de información de varios campos.
 *
 * No evalúa adecuación ni cumplimiento del candidato.
 */
function evaluateFieldsCoverage(
  values: (string | null | undefined)[]
): CoverageLevel {
  const knownCount = values.filter(isKnownValue).length;

  if (knownCount === 0) {
    return "UNKNOWN";
  }

  if (knownCount === values.length) {
    return "FULL";
  }

  return "LIMITED";
}

/**
 * En la primera versión, la existencia de requisitos extraídos
 * demuestra que hay información utilizable, pero no que la
 * extracción sea completa. Por ello, nunca asigna FULL.
 *
 * Una lista vacía no demuestra que la categoría no sea aplicable.
 */
function evaluateRequirementGroup(
  requirements: ExtractedRequirement[],
  category: ExtractedRequirement["category"],
  importance: "required" | "preferred",
  extractionStatus: "COMPLETED" | "FAILED"
): CoverageLevel {
  if (extractionStatus === "FAILED") {
    return "UNKNOWN";
  }

  const hasRequirements = requirements.some(
    (requirement) =>
      requirement.category === category &&
      requirement.importance === importance
  );

  return hasRequirements ? "LIMITED" : "UNKNOWN";
}

function evaluateRequirementCategory(
  requirements: ExtractedRequirement[],
  category: ExtractedRequirement["category"],
  extractionStatus: "COMPLETED" | "FAILED"
): number | null {
  const requiredLevel = evaluateRequirementGroup(
    requirements,
    category,
    "required",
    extractionStatus
  );

  const preferredLevel = evaluateRequirementGroup(
    requirements,
    category,
    "preferred",
    extractionStatus
  );

  return calculateRequirementCoverage(
    [requiredLevel],
    [preferredLevel]
  );
}

function scoreFieldGroup(
  level: CoverageLevel
): number | null {
  return calculateCoverageScore([{ level, weight: 1 }]);
}

/**
 * Evalúa Coverage usando únicamente disponibilidad de información.
 *
 * No usa matching, scoring ni datos del perfil del candidato.
 */
export function evaluateCoverage(
  input: CoverageEvaluationInput
): CoverageBreakdown {
  const familyLevel = isKnownValue(input.jobFamily)
    ? "FULL"
    : "UNKNOWN";

  const roleLevel = isKnownValue(input.role)
    ? "FULL"
    : "UNKNOWN";

  const locationLevel = evaluateFieldsCoverage([
    input.country,
    input.city,
    input.modality
  ]);

  const employmentConditionsLevel = evaluateFieldsCoverage([
    input.contract,
    input.employmentType,
    input.workingHours
  ]);

  return {
    job_type: calculateFamilyRoleCoverage(
      familyLevel,
      roleLevel
    ),

    technologies: evaluateRequirementCategory(
      input.requirements,
      "technology",
      input.extractionStatus
    ),

    experience: evaluateRequirementCategory(
      input.requirements,
      "experience",
      input.extractionStatus
    ),

    location: scoreFieldGroup(locationLevel),

    employment_conditions: scoreFieldGroup(
      employmentConditionsLevel
    ),

    languages: evaluateRequirementCategory(
      input.requirements,
      "language",
      input.extractionStatus
    ),

    other_requirements: evaluateRequirementCategory(
      input.requirements,
      "other",
      input.extractionStatus
    )
  };
}
