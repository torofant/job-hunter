import { describe, expect, it } from "vitest";

import { userProfileSchema } from "../../src/modules/jobs/user-profile.js";

describe("userProfileSchema", () => {
  it("acepta un perfil válido", () => {
    const result = userProfileSchema.safeParse({
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
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un nivel de idioma inválido", () => {
    const result = userProfileSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",

      targetRoles: [],
      technologies: [],
      experiences: [],

      languages: [
        {
          language: "english",
          level: "advanced"
        }
      ],

      locationPreferences: {
        remoteAllowed: true,
        hybridAllowed: true,
        onsiteAllowed: true,
        hybridMaxCity: null,
        onsiteMaxDistanceKm: null,
        relocationAllowed: false
      },

      employmentPreferences: {
        fullTimeAllowed: true,
        partTimeAllowed: false,
        permanentAllowed: true,
        temporaryAllowed: false,
        internshipAllowed: false,
        scholarshipAllowed: false,
        traineeAllowed: false,
        freelanceAllowed: false,
        selfEmployedAllowed: false
      },

      salaryPreferences: {
        currency: "EUR",
        minimum: 20000,
        desired: 24000
      }
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un rol de destino inválido", () => {
    const result = userProfileSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",

      targetRoles: [
        {
          family: "WEB",
          role: "INVALID_ROLE",
          priorityOrder: 0
        }
      ],

      technologies: [],
      experiences: [],
      languages: [],

      locationPreferences: {
        remoteAllowed: true,
        hybridAllowed: true,
        onsiteAllowed: true,
        hybridMaxCity: null,
        onsiteMaxDistanceKm: null,
        relocationAllowed: false
      },

      employmentPreferences: {
        fullTimeAllowed: true,
        partTimeAllowed: false,
        permanentAllowed: true,
        temporaryAllowed: false,
        internshipAllowed: false,
        scholarshipAllowed: false,
        traineeAllowed: false,
        freelanceAllowed: false,
        selfEmployedAllowed: false
      },

      salaryPreferences: {
        currency: "EUR",
        minimum: 20000,
        desired: 24000
      }
    });

    expect(result.success).toBe(false);
  });
});