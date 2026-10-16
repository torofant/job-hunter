import { normalizeTechnology } from "./technology.normalizer.js";
import type { MatchEvaluation } from "./match-evaluation.js";
import type { Requirement } from "./requirement.js";
import type { RequirementMatch } from "./requirement-match.js";
import type { UserProfile } from "./user-profile.js";

function getUserTechnologies(userProfile: UserProfile): Set<string> {
  const technologies = new Set<string>();

  for (const technology of userProfile.technologies) {
    technologies.add(normalizeTechnology(technology.name));
  }

  for (const experience of userProfile.experiences) {
    for (const technology of experience.technologies) {
      technologies.add(normalizeTechnology(technology));
    }
  }

  return technologies;
}

export function evaluateTechnologyRequirement(
  requirement: Requirement,
  userProfile: UserProfile
): MatchEvaluation {
  if (
    requirement.category !== "technology" ||
    requirement.type !== "single"
  ) {
    throw new Error(
      "La función evaluateTechnologyRequirement requiere un requisito simple de tecnología"
    );
  }

  return evaluateTechnologyData(requirement.data, userProfile);
}

export function matchTechnologyRequirement(
  requirement: Requirement,
  userProfile: UserProfile
): RequirementMatch {
  const evaluation = evaluateTechnologyRequirement(
    requirement,
    userProfile
  );

  return {
    requirementId: requirement.id,
    ...evaluation
  };
}

export function evaluateTechnologyData(
  data: { technology: string },
  userProfile: UserProfile
): MatchEvaluation {
  const requiredTechnology = normalizeTechnology(data.technology);

  const userTechnologies = getUserTechnologies(userProfile);

  if (userTechnologies.has(requiredTechnology)) {
    return {
      result: "MATCH",
      evidence: {
        technology: requiredTechnology,
        source: "USER_PROFILE"
      }
    };
  }

  if (userTechnologies.size > 0) {
    return {
      result: "MISSING",
      evidence: {
        technology: requiredTechnology,
        source: "USER_PROFILE"
      }
    };
  }

  return {
    result: "UNKNOWN",
    evidence: {
      technology: requiredTechnology,
      source: "USER_PROFILE"
    }
  };
}