import { describe, expect, it } from "vitest";
import { matchRequirement } from "../../src/modules/jobs/requirement.matcher.js";
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

function createRequirement(
  requirement: Omit<Requirement, "id">
): Requirement {
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    ...requirement
  } as Requirement;
}

describe("matchRequirement", () => {
  it("evalúa un requisito simple de tecnología", () => {
    const requirement = createRequirement({
      category: "technology",
      type: "single",
      importance: "required",
      data: {
        technology: "JavaScript"
      }
    });

    const result = matchRequirement(
      requirement,
      userProfileBase,
      "2026-01-01"
    );

    expect(result.result).toBe("MATCH");
    expect(result.requirementId).toBe(requirement.id);
  });

  it("evalúa un requisito simple de experiencia", () => {
    const requirement = createRequirement({
      category: "experience",
      type: "single",
      importance: "required",
      data: {
        target: {
          type: "technology",
          value: "JavaScript"
        },
        minimumYears: 2
      }
    });

    const result = matchRequirement(
      requirement,
      userProfileBase,
      "2026-01-01"
    );

    expect(result.result).toBe("MATCH");
    expect(result.requirementId).toBe(requirement.id);
  });

  it("evalúa un requisito simple de idioma", () => {
    const requirement = createRequirement({
      category: "language",
      type: "single",
      importance: "required",
      data: {
        language: "English",
        minimumLevel: "B1"
      }
    });

    const result = matchRequirement(
      requirement,
      userProfileBase,
      "2026-01-01"
    );

    expect(result.result).toBe("MATCH");
    expect(result.requirementId).toBe(requirement.id);
  });

  it("compone una alternativa cuando una opción coincide", () => {
    const requirement = createRequirement({
      category: "technology",
      type: "alternative",
      importance: "required",
      data: {
        options: [
          { technology: "Python" },
          { technology: "JavaScript" }
        ]
      }
    });

    const result = matchRequirement(
      requirement,
      userProfileBase,
      "2026-01-01"
    );

    expect(result.result).toBe("MATCH");
    expect(result.requirementId).toBe(requirement.id);
    expect(result.evidence).toMatchObject({
      type: "alternative"
    });
  });

  it("compone una alternativa como MISSING cuando todas las opciones faltan", () => {
    const requirement = createRequirement({
      category: "technology",
      type: "alternative",
      importance: "required",
      data: {
        options: [
          { technology: "Python" },
          { technology: "Java" }
        ]
      }
    });

    const result = matchRequirement(
      requirement,
      userProfileBase,
      "2026-01-01"
    );

    expect(result.result).toBe("MISSING");
    expect(result.requirementId).toBe(requirement.id);
  });

  it("compone una alternativa como UNKNOWN cuando no hay información tecnológica", () => {
    const profile: UserProfile = {
      ...userProfileBase,
      technologies: [],
      experiences: []
    };

    const requirement = createRequirement({
      category: "technology",
      type: "alternative",
      importance: "required",
      data: {
        options: [
          { technology: "Python" },
          { technology: "Java" }
        ]
      }
    });

    const result = matchRequirement(
      requirement,
      profile,
      "2026-01-01"
    );

    expect(result.result).toBe("UNKNOWN");
    expect(result.requirementId).toBe(requirement.id);
  });

  it("compone un grupo como MATCH cuando todos los componentes coinciden", () => {
    const requirement = createRequirement({
      category: "technology",
      type: "group",
      importance: "required",
      data: {
        components: [
          { technology: "JavaScript" },
          { technology: "Node.js" }
        ]
      }
    });

    const result = matchRequirement(
      requirement,
      userProfileBase,
      "2026-01-01"
    );

    expect(result.result).toBe("MATCH");
    expect(result.requirementId).toBe(requirement.id);
  });

  it("compone un grupo como PARTIAL cuando falta un componente pero otro coincide", () => {
    const requirement = createRequirement({
      category: "technology",
      type: "group",
      importance: "required",
      data: {
        components: [
          { technology: "JavaScript" },
          { technology: "Python" }
        ]
      }
    });

    const result = matchRequirement(
      requirement,
      userProfileBase,
      "2026-01-01"
    );

    expect(result.result).toBe("PARTIAL");
    expect(result.requirementId).toBe(requirement.id);
  });

  it("compone un grupo como MISSING cuando falta un componente y existe información desconocida", () => {
    const profile: UserProfile = {
      ...userProfileBase,
      technologies: [
        {
          name: "javascript",
          level: "advanced",
          context: "professional"
        }
      ],
      experiences: []
    };

    const requirement = createRequirement({
      category: "technology",
      type: "group",
      importance: "required",
      data: {
        components: [
          { technology: "Python" },
          { technology: "Java" }
        ]
      }
    });

    const result = matchRequirement(
      requirement,
      profile,
      "2026-01-01"
    );

    expect(result.result).toBe("MISSING");
    expect(result.requirementId).toBe(requirement.id);
  });

  it("mantiene el requirementId del requisito padre en alternativas y grupos", () => {
    const requirement = createRequirement({
      category: "language",
      type: "alternative",
      importance: "preferred",
      data: {
        options: [
          {
            language: "English",
            minimumLevel: "B1"
          },
          {
            language: "German",
            minimumLevel: "B1"
          }
        ]
      }
    });

    const result = matchRequirement(
      requirement,
      userProfileBase,
      "2026-01-01"
    );

    expect(result.requirementId).toBe(
      "550e8400-e29b-41d4-a716-446655440001"
    );
  });
});