import { describe, expect, it } from "vitest";

import {
  evaluateLanguageRequirement,
  matchLanguageRequirement
} from "../../src/modules/jobs/language.matcher.js";
import type { Requirement } from "../../src/modules/jobs/requirement.js";
import type { UserProfile } from "../../src/modules/jobs/user-profile.js";

const userProfileBase: UserProfile = {
  id: "550e8400-e29b-41d4-a716-446655440000",

  targetRoles: [
    {
      family: "WEB",
      role: "FULL_STACK_DEVELOPER",
      priorityOrder: 0
    }
  ],

  technologies: [],

  experiences: [],

  languages: [
    {
      language: "english",
      level: "B1"
    },
    {
      language: "spanish",
      level: "C2"
    }
  ],

  locationPreferences: {
    remoteAllowed: true,
    hybridAllowed: true,
    onsiteAllowed: true,
    hybridMaxCity: "Valencia",
    onsiteMaxDistanceKm: 75,
    relocationAllowed: false
  },

  employmentPreferences: {
    fullTimeAllowed: true,
    partTimeAllowed: true,
    permanentAllowed: true,
    temporaryAllowed: false,
    internshipAllowed: false,
    scholarshipAllowed: false,
    traineeAllowed: false,
    freelanceAllowed: true,
    selfEmployedAllowed: true
  },

  salaryPreferences: {
    currency: "EUR",
    minimum: 20000,
    desired: 24000
  }
};

function createLanguageRequirement(
  language: string,
  minimumLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
): Requirement {
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    category: "language",
    type: "single",
    importance: "required",
    data: {
      language,
      minimumLevel
    }
  };
}

describe("matchLanguageRequirement", () => {
  it("marca MATCH cuando el nivel del idioma alcanza el mínimo", () => {
    const requirement = createLanguageRequirement(
      "English",
      "B1"
    );

    const result = matchLanguageRequirement(
      requirement,
      userProfileBase
    );

    expect(result.result).toBe("MATCH");
    expect(result.requirementId).toBe(requirement.id);
  });

  it("marca MATCH cuando el nivel del usuario es superior al mínimo", () => {
    const requirement = createLanguageRequirement(
      "English",
      "A2"
    );

    const result = matchLanguageRequirement(
      requirement,
      userProfileBase
    );

    expect(result.result).toBe("MATCH");
  });

  it("marca MISSING cuando el nivel del usuario es inferior al mínimo", () => {
    const requirement = createLanguageRequirement(
      "English",
      "B2"
    );

    const result = matchLanguageRequirement(
      requirement,
      userProfileBase
    );

    expect(result.result).toBe("MISSING");
  });

  it("marca MISSING cuando el idioma requerido no aparece en un perfil con idiomas", () => {
    const requirement = createLanguageRequirement(
      "German",
      "B1"
    );

    const result = matchLanguageRequirement(
      requirement,
      userProfileBase
    );

    expect(result.result).toBe("MISSING");
  });

  it("marca UNKNOWN cuando el perfil no contiene información de idiomas", () => {
    const profile: UserProfile = {
      ...userProfileBase,
      languages: []
    };

    const requirement = createLanguageRequirement(
      "German",
      "B1"
    );

    const result = matchLanguageRequirement(
      requirement,
      profile
    );

    expect(result.result).toBe("UNKNOWN");
  });

  it("normaliza alias del idioma antes de comparar", () => {
    const profile: UserProfile = {
      ...userProfileBase,
      languages: [
        {
          language: "inglés",
          level: "B1"
        }
      ]
    };

    const requirement = createLanguageRequirement(
      "English",
      "B1"
    );

    const result = matchLanguageRequirement(
      requirement,
      profile
    );

    expect(result.result).toBe("MATCH");
  });

  it("compara correctamente todos los niveles CEFR", () => {
    const levels = [
      "A1",
      "A2",
      "B1",
      "B2",
      "C1",
      "C2"
    ] as const;

    for (const level of levels) {
      const profile: UserProfile = {
        ...userProfileBase,
        languages: [
          {
            language: "english",
            level
          }
        ]
      };

      const requirement = createLanguageRequirement(
        "English",
        level
      );

      const result = matchLanguageRequirement(
        requirement,
        profile
      );

      expect(result.result).toBe("MATCH");
    }
  });

  it("rechaza un requisito que no sea un idioma simple", () => {
    const requirement: Requirement = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      category: "technology",
      type: "single",
      importance: "required",
      data: {
        technology: "javascript"
      }
    };

    expect(() =>
      matchLanguageRequirement(
        requirement,
        userProfileBase
      )
    ).toThrow();
  });

  it("evalúa un idioma sin generar un requirementId", () => {
    const requirement = createLanguageRequirement(
      "English",
      "B1"
    );

    const result = evaluateLanguageRequirement(
      requirement,
      userProfileBase
    );

    expect(result).toEqual({
      result: "MATCH",
      evidence: {
        language: "english",
        minimumLevel: "B1",
        userLevel: "B1"
      }
    });
  });
});