import { normalizeTechnology, normalizeText } from "./technology.normalizer.js";
import type { MatchEvaluation } from "./match-evaluation.js";
import type { Requirement } from "./requirement.js";
import type { RequirementMatch } from "./requirement-match.js";
import type { UserProfile } from "./user-profile.js";

type ExperienceInterval = {
  start: string;
  end: string;
};

type ExperienceTarget = {
  type: "technology" | "role" | "area";
  value: string;
};

type ExperienceRequirementData = {
  target: ExperienceTarget;
  minimumYears: number;
};

function isCountableExperience(
  contextType: "PROFESSIONAL" | "ACADEMIC" | "PERSONAL"
): boolean {
  return (
    contextType === "PROFESSIONAL" ||
    contextType === "ACADEMIC"
  );
}

function resolveEndDate(
  end: string | null,
  referenceDate: string
): string {
  return end ?? referenceDate;
}

function mergeIntervals(
  intervals: ExperienceInterval[]
): ExperienceInterval[] {
  const sorted = [...intervals].sort((a, b) =>
    a.start.localeCompare(b.start)
  );

  const merged: ExperienceInterval[] = [];

  for (const interval of sorted) {
    const current = merged[merged.length - 1];

    if (!current || interval.start > current.end) {
      merged.push({ ...interval });
      continue;
    }

    if (interval.end > current.end) {
      current.end = interval.end;
    }
  }

  return merged;
}

function calculateExperienceYears(
  intervals: ExperienceInterval[]
): number {
  const mergedIntervals = mergeIntervals(intervals);

  let totalMonths = 0;

  for (const interval of mergedIntervals) {
    const start = new Date(`${interval.start}T00:00:00Z`);
    const end = new Date(`${interval.end}T00:00:00Z`);

    let months =
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - start.getUTCMonth());

    if (end.getUTCDate() < start.getUTCDate()) {
      months -= 1;
    }

    totalMonths += Math.max(months, 0);
  }

  return totalMonths / 12;
}

function experienceMatchesTarget(
  experience: UserProfile["experiences"][number],
  target: ExperienceTarget
): boolean {
  const normalizedValue = normalizeText(target.value);

  if (target.type === "technology") {
    return experience.technologies.some(
      (technology) =>
        normalizeTechnology(technology) ===
        normalizeTechnology(target.value)
    );
  }

  if (target.type === "role") {
    return normalizeText(experience.role) === normalizedValue;
  }

  return (
    experience.area !== null &&
    normalizeText(experience.area) === normalizedValue
  );
}

export function evaluateExperienceData(
  data: ExperienceRequirementData,
  userProfile: UserProfile,
  referenceDate: string
): MatchEvaluation {
  const { target, minimumYears } = data;

  const matchingExperiences = userProfile.experiences.filter(
    (experience) =>
      experienceMatchesTarget(experience, target)
  );

  if (matchingExperiences.length === 0) {
    const hasRelevantExperienceInformation =
      userProfile.experiences.some((experience) => {
        if (target.type === "technology") {
          return experience.technologies.length > 0;
        }

        if (target.type === "role") {
          return Boolean(experience.role);
        }

        return experience.area !== null;
      });

    return {
      result: hasRelevantExperienceInformation
        ? "MISSING"
        : "UNKNOWN",
      evidence: {
        target,
        minimumYears,
        years: 0
      }
    };
  }

  const countableExperiences = matchingExperiences.filter(
    (experience) =>
      isCountableExperience(experience.contextType)
  );

  const intervals = countableExperiences.map(
    (experience) => ({
      start: experience.start,
      end: resolveEndDate(
        experience.end,
        referenceDate
      )
    })
  );

  const years = calculateExperienceYears(intervals);

  return {
    result: years >= minimumYears
      ? "MATCH"
      : "MISSING",
    evidence: {
      target,
      minimumYears,
      years
    }
  };
}

export function evaluateExperienceRequirement(
  requirement: Requirement,
  userProfile: UserProfile,
  referenceDate: string
): MatchEvaluation {
  if (
    requirement.category !== "experience" ||
    requirement.type !== "single"
  ) {
    throw new Error(
      "La función evaluateExperienceRequirement requiere un requisito simple de experiencia"
    );
  }

  return evaluateExperienceData(
    requirement.data,
    userProfile,
    referenceDate
  );
}

export function matchExperienceRequirement(
  requirement: Requirement,
  userProfile: UserProfile,
  referenceDate: string
): RequirementMatch {
  const evaluation = evaluateExperienceRequirement(
    requirement,
    userProfile,
    referenceDate
  );

  return {
    requirementId: requirement.id,
    ...evaluation
  };
}