import { describe, expect, it } from "vitest";

import { 
    matchTechnologyRequirement,
    evaluateTechnologyRequirement
} from "../../src/modules/jobs/technology.matcher.js";
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

  technologies: [
    {
      name: "javascript",
      level: "advanced",
      context: "professional"
    }
  ],

  experiences: [
    {
      role: "WEB_DEVELOPER",
      area: "web",
      context: "Desarrollo de aplicaciones web",
      start: "2024-01-01",
      end: null,
      technologies: ["javascript", "nodejs"],
      responsibilities: ["Desarrollo web"],
      description: "Desarrollo de aplicaciones web",
      contextType: "PROFESSIONAL"
    }
  ],

  languages: [
    {
      language: "english",
      level: "B1"
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

function createTechnologyRequirement(
  technology: string
): Requirement {
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    category: "technology",
    type: "single",
    importance: "required",
    data: {
      technology
    }
  };
}

describe("matchTechnologyRequirement", () => {
  it("marca MATCH cuando la tecnología está declarada en el perfil", () => {
    const requirement = createTechnologyRequirement("JavaScript");

    const result = matchTechnologyRequirement(
      requirement,
      userProfileBase
    );

    expect(result.result).toBe("MATCH");
    expect(result.requirementId).toBe(requirement.id);
  });

  it("marca MATCH cuando la tecnología aparece en una experiencia", () => {
    const profile: UserProfile = {
      ...userProfileBase,
      technologies: []
    };

    const requirement = createTechnologyRequirement("Node.js");

    const result = matchTechnologyRequirement(
      requirement,
      profile
    );

    expect(result.result).toBe("MATCH");
  });

  it("marca MATCH cuando la tecnología utiliza un alias conocido", () => {
    const requirement = createTechnologyRequirement("JS");

    const result = matchTechnologyRequirement(
      requirement,
      userProfileBase
    );

    expect(result.result).toBe("MATCH");
  });

  it("marca MISSING cuando existe información tecnológica pero falta la requerida", () => {
    const requirement = createTechnologyRequirement("Python");

    const result = matchTechnologyRequirement(
      requirement,
      userProfileBase
    );

    expect(result.result).toBe("MISSING");
  });

  it("marca UNKNOWN cuando el perfil no contiene información tecnológica", () => {
    const profile: UserProfile = {
      ...userProfileBase,
      technologies: [],
      experiences: []
    };

    const requirement = createTechnologyRequirement("Python");

    const result = matchTechnologyRequirement(
      requirement,
      profile
    );

    expect(result.result).toBe("UNKNOWN");
  });

  it("no considera Java y JavaScript como la misma tecnología", () => {
    const requirement = createTechnologyRequirement("Java");

    const result = matchTechnologyRequirement(
      requirement,
      userProfileBase
    );

    expect(result.result).toBe("MISSING");
  });

  it("no considera React y React Native como la misma tecnología", () => {
    const profile: UserProfile = {
      ...userProfileBase,
      technologies: [
        {
          name: "React Native",
          level: null,
          context: null
        }
      ],
      experiences: []
    };

    const requirement = createTechnologyRequirement("React");

    const result = matchTechnologyRequirement(
      requirement,
      profile
    );

    expect(result.result).toBe("MISSING");
  });

  it("rechaza un requisito que no sea una tecnología simple", () => {
    const requirement: Requirement = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      category: "language",
      type: "single",
      importance: "required",
      data: {
        language: "english",
        minimumLevel: "B1"
      }
    };

    expect(() =>
      matchTechnologyRequirement(
        requirement,
        userProfileBase
      )
    ).toThrow();
  });

  it("evalúa una tecnología sin generar un requirementId", () => {
  const requirement = createTechnologyRequirement("JavaScript");

  const result = evaluateTechnologyRequirement(
    requirement,
    userProfileBase
  );

  expect(result).toEqual({
    result: "MATCH",
    evidence: {
      technology: "javascript",
      source: "USER_PROFILE"
    }
  });
});
});