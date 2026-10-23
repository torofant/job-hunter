import { evaluateTechnologyData } from "./technology.matcher.js";
import { evaluateExperienceData } from "./experience.matcher.js";
import { evaluateLanguageData } from "./language.matcher.js";
import {
  composeAlternativeResult,
  composeGroupResult
} from "./requirement.composer.js";
import type { MatchEvaluation } from "./match-evaluation.js";
import type { Requirement } from "./requirement.js";
import type { RequirementMatch } from "./requirement-match.js";
import type { UserProfile } from "./user-profile.js";

function evaluateAlternative(
  requirement: Requirement,
  userProfile: UserProfile,
  referenceDate: string
): MatchEvaluation {
  if (
    requirement.category === "technology" &&
    requirement.type === "alternative"
  ) {
    const evaluations = requirement.data.options.map((option) =>
      evaluateTechnologyData(option, userProfile)
    );

    return {
      result: composeAlternativeResult(evaluations),
      evidence: {
        type: "alternative",
        evaluations
      }
    };
  }

  if (
    requirement.category === "experience" &&
    requirement.type === "alternative"
  ) {
    const evaluations = requirement.data.options.map((option) =>
      evaluateExperienceData(
        option,
        userProfile,
        referenceDate
      )
    );

    return {
      result: composeAlternativeResult(evaluations),
      evidence: {
        type: "alternative",
        evaluations
      }
    };
  }

  if (
    requirement.category === "language" &&
    requirement.type === "alternative"
  ) {
    const evaluations = requirement.data.options.map((option) =>
      evaluateLanguageData(option, userProfile)
    );

    return {
      result: composeAlternativeResult(evaluations),
      evidence: {
        type: "alternative",
        evaluations
      }
    };
  }

  throw new Error(
    "El requisito no es una alternativa válida"
  );
}

function evaluateGroup(
  requirement: Requirement,
  userProfile: UserProfile,
  referenceDate: string
): MatchEvaluation {
  if (
    requirement.category === "technology" &&
    requirement.type === "group"
  ) {
    const evaluations = requirement.data.components.map(
      (component) =>
        evaluateTechnologyData(component, userProfile)
    );

    return {
      result: composeGroupResult(evaluations),
      evidence: {
        type: "group",
        evaluations
      }
    };
  }

  if (
    requirement.category === "experience" &&
    requirement.type === "group"
  ) {
    const evaluations = requirement.data.components.map(
      (component) =>
        evaluateExperienceData(
          component,
          userProfile,
          referenceDate
        )
    );

    return {
      result: composeGroupResult(evaluations),
      evidence: {
        type: "group",
        evaluations
      }
    };
  }

  if (
    requirement.category === "language" &&
    requirement.type === "group"
  ) {
    const evaluations = requirement.data.components.map(
      (component) =>
        evaluateLanguageData(component, userProfile)
    );

    return {
      result: composeGroupResult(evaluations),
      evidence: {
        type: "group",
        evaluations
      }
    };
  }

  throw new Error(
    "El requisito no es un grupo válido"
  );
}

export function matchRequirement(
  requirement: Requirement,
  userProfile: UserProfile,
  referenceDate: string
): RequirementMatch {
  let evaluation: MatchEvaluation;

  if (requirement.category === "other") {
    evaluation = {
      result: "UNKNOWN",
      evidence: {
        type: "unknown"
      }
    };
  } else if (requirement.type === "single") {
    if (requirement.category === "technology") {
      evaluation = evaluateTechnologyData(
        requirement.data,
        userProfile
      );
    } else if (requirement.category === "experience") {
      evaluation = evaluateExperienceData(
        requirement.data,
        userProfile,
        referenceDate
      );
    } else {
      evaluation = evaluateLanguageData(
        requirement.data,
        userProfile
      );
    }
  } else if (requirement.type === "alternative") {
    evaluation = evaluateAlternative(
      requirement,
      userProfile,
      referenceDate
    );
  } else {
    evaluation = evaluateGroup(
      requirement,
      userProfile,
      referenceDate
    );
  }

  return {
    requirementId: requirement.id,
    ...evaluation
  };
}