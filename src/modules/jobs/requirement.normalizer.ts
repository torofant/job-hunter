import type {
  ExtractedRequirement
} from "./requirement-extraction.js";
import type { Requirement } from "./requirement.js";
import { normalizeTechnology } from "./technology.normalizer.js";
import { normalizeText } from "./technology.normalizer.js";
import { randomUUID } from "node:crypto";

type NormalizedRequirement = ExtractedRequirement;

const LANGUAGE_ALIASES: Record<string, string> = {
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


function normalizeLanguage(value: string): string {
  const normalized = normalizeText(value);

  return LANGUAGE_ALIASES[normalized] ?? normalized;
}

function normalizeExperienceTarget(target: {
  type: "technology" | "role" | "area";
  value: string;
}) {
  return {
    type: target.type,
    value:
      target.type === "technology"
        ? normalizeTechnology(target.value)
        : normalizeText(target.value)
  };
}

function normalizeTechnologyRequirement(
  requirement: ExtractedRequirement & {
    category: "technology";
  }
): NormalizedRequirement {
  if (requirement.type === "single") {
    return {
      ...requirement,
      data: {
        technology: normalizeTechnology(requirement.data.technology)
      }
    };
  }

  if (requirement.type === "alternative") {
    return {
      ...requirement,
      data: {
        options: requirement.data.options
          .map((item) => ({
            technology: normalizeTechnology(item.technology)
          }))
          .sort((a, b) => a.technology.localeCompare(b.technology))
      }
    };
  }

  return {
    ...requirement,
    data: {
      components: requirement.data.components
        .map((item) => ({
          technology: normalizeTechnology(item.technology)
        }))
        .sort((a, b) => a.technology.localeCompare(b.technology))
    }
  };
}

function normalizeExperienceRequirement(
  requirement: ExtractedRequirement & {
    category: "experience";
  }
): NormalizedRequirement {
  if (requirement.type === "single") {
    return {
      ...requirement,
      data: {
        target: normalizeExperienceTarget(requirement.data.target),
        minimumYears: requirement.data.minimumYears
      }
    };
  }

  if (requirement.type === "alternative") {
    return {
      ...requirement,
      data: {
        options: requirement.data.options
          .map((item) => ({
            target: normalizeExperienceTarget(item.target),
            minimumYears: item.minimumYears
          }))
          .sort((a, b) => {
            const targetA = `${a.target.type}:${a.target.value}`;
            const targetB = `${b.target.type}:${b.target.value}`;

            const targetComparison = targetA.localeCompare(targetB);

            if (targetComparison !== 0) {
              return targetComparison;
            }

            return a.minimumYears - b.minimumYears;
          })
      }
    };
  }

  return {
    ...requirement,
    data: {
      components: requirement.data.components
        .map((item) => ({
          target: normalizeExperienceTarget(item.target),
          minimumYears: item.minimumYears
        }))
        .sort((a, b) => {
          const targetA = `${a.target.type}:${a.target.value}`;
          const targetB = `${b.target.type}:${b.target.value}`;

          const targetComparison = targetA.localeCompare(targetB);

          if (targetComparison !== 0) {
            return targetComparison;
          }

          return a.minimumYears - b.minimumYears;
        })
    }
  };
}

function normalizeLanguageRequirement(
  requirement: ExtractedRequirement & {
    category: "language";
  }
): NormalizedRequirement {
  if (requirement.type === "single") {
    return {
      ...requirement,
      data: {
        language: normalizeLanguage(requirement.data.language),
        minimumLevel: requirement.data.minimumLevel
      }
    };
  }

  if (requirement.type === "alternative") {
    return {
      ...requirement,
      data: {
        options: requirement.data.options
          .map((item) => ({
            language: normalizeLanguage(item.language),
            minimumLevel: item.minimumLevel
          }))
          .sort((a, b) => {
            const languageA = `${a.language}:${a.minimumLevel}`;
            const languageB = `${b.language}:${b.minimumLevel}`;

            return languageA.localeCompare(languageB);
          })
      }
    };
  }

  return {
    ...requirement,
    data: {
      components: requirement.data.components
        .map((item) => ({
          language: normalizeLanguage(item.language),
          minimumLevel: item.minimumLevel
        }))
        .sort((a, b) => {
          const languageA = `${a.language}:${a.minimumLevel}`;
          const languageB = `${b.language}:${b.minimumLevel}`;

          return languageA.localeCompare(languageB);
        })
    }
  };
}

export function normalizeRequirement(
  requirement: ExtractedRequirement
): NormalizedRequirement {
  if (requirement.category === "technology") {
    return normalizeTechnologyRequirement(requirement);
  }

  if (requirement.category === "experience") {
    return normalizeExperienceRequirement(requirement);
  }

  return normalizeLanguageRequirement(requirement);
}

function requirementIdentity(requirement: NormalizedRequirement): string {
  return JSON.stringify({
    category: requirement.category,
    type: requirement.type,
    importance: requirement.importance,
    data: requirement.data
  });
}

export function deduplicateRequirements(
  requirements: NormalizedRequirement[]
): NormalizedRequirement[] {
  const seen = new Set<string>();
  const result: NormalizedRequirement[] = [];

  for (const requirement of requirements) {
    const identity = requirementIdentity(requirement);

    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    result.push(requirement);
  }

  return result;
}

export function normalizeAndDeduplicateRequirements(
  requirements: ExtractedRequirement[]
): Requirement[] {
  const normalized = requirements.map(normalizeRequirement);
  const deduplicated = deduplicateRequirements(normalized);

  return deduplicated.map((requirement) => ({
    id: randomUUID(),
    ...requirement
  }));
}

export function haveSameRequirementSet(
  first: Requirement[],
  second: Requirement[]
): boolean {
  if (first.length !== second.length) {
    return false;
  }

  const identity = (requirement: Requirement): string =>
    JSON.stringify({
      category: requirement.category,
      type: requirement.type,
      importance: requirement.importance,
      data: requirement.data
    });

  const firstIdentities = first.map(identity).sort();
  const secondIdentities = second.map(identity).sort();

  return firstIdentities.every(
    (value, index) => value === secondIdentities[index]
  );
}