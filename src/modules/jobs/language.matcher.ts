import { normalizeText } from "./technology.normalizer.js";
import type { MatchEvaluation } from "./match-evaluation.js";
import type { Requirement } from "./requirement.js";
import type { RequirementMatch } from "./requirement-match.js";
import type { UserProfile } from "./user-profile.js";

const LANGUAGE_LEVELS = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6
} as const;

type LanguageLevel = keyof typeof LANGUAGE_LEVELS;

type LanguageRequirementData = {
  language: string;
  minimumLevel: LanguageLevel;
};

function normalizeLanguage(value: string): string {
  const normalized = normalizeText(value);

  const aliases: Record<string, string> = {
    english: "english",
    inglés: "english",
    ingles: "english",

    spanish: "spanish",
    español: "spanish",
    espanol: "spanish",

    french: "french",
    francés: "french",
    frances: "french",

    german: "german",
    alemán: "german",
    aleman: "german"
  };

  return aliases[normalized] ?? normalized;
}

export function evaluateLanguageData(
  data: LanguageRequirementData,
  userProfile: UserProfile
): MatchEvaluation {
  const requiredLanguage = normalizeLanguage(
    data.language
  );

  const requiredLevel = data.minimumLevel;

  const matchingLanguage = userProfile.languages.find(
    (language) =>
      normalizeLanguage(language.language) ===
      requiredLanguage
  );

  if (!matchingLanguage) {
    return {
      result: userProfile.languages.length > 0
        ? "MISSING"
        : "UNKNOWN",
      evidence: {
        language: requiredLanguage,
        minimumLevel: requiredLevel
      }
    };
  }

  const userLevel =
    LANGUAGE_LEVELS[matchingLanguage.level as LanguageLevel];

  const minimumLevel =
    LANGUAGE_LEVELS[requiredLevel];

  return {
    result: userLevel >= minimumLevel
      ? "MATCH"
      : "MISSING",
    evidence: {
      language: requiredLanguage,
      minimumLevel: requiredLevel,
      userLevel: matchingLanguage.level
    }
  };
}

export function evaluateLanguageRequirement(
  requirement: Requirement,
  userProfile: UserProfile
): MatchEvaluation {
  if (
    requirement.category !== "language" ||
    requirement.type !== "single"
  ) {
    throw new Error(
      "La función evaluateLanguageRequirement requiere un requisito simple de idioma"
    );
  }

  return evaluateLanguageData(
    requirement.data,
    userProfile
  );
}

export function matchLanguageRequirement(
  requirement: Requirement,
  userProfile: UserProfile
): RequirementMatch {
  const evaluation = evaluateLanguageRequirement(
    requirement,
    userProfile
  );

  return {
    requirementId: requirement.id,
    ...evaluation
  };
}