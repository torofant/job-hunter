import { describe, expect, it } from "vitest";

import {
    evaluateExperienceRequirement,
    matchExperienceRequirement
} from "../../src/modules/jobs/experience.matcher.js"; import type { Requirement } from "../../src/modules/jobs/requirement.js";
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

function createExperienceRequirement(
    target: {
        type: "technology" | "role" | "area";
        value: string;
    },
    minimumYears: number
): Requirement {
    return {
        id: "550e8400-e29b-41d4-a716-446655440001",
        category: "experience",
        type: "single",
        importance: "required",
        data: {
            target,
            minimumYears
        }
    };
}

describe("matchExperienceRequirement", () => {
    it("marca MATCH cuando la experiencia por tecnología alcanza el mínimo", () => {
        const requirement = createExperienceRequirement(
            {
                type: "technology",
                value: "JavaScript"
            },
            2
        );

        const result = matchExperienceRequirement(
            requirement,
            userProfileBase,
            "2026-01-01"
        );

        expect(result.result).toBe("MATCH");
        expect(result.requirementId).toBe(requirement.id);
    });

    it("marca MATCH cuando el rol de la experiencia coincide", () => {
        const requirement = createExperienceRequirement(
            {
                type: "role",
                value: "WEB_DEVELOPER"
            },
            2
        );

        const result = matchExperienceRequirement(
            requirement,
            userProfileBase,
            "2026-01-01"
        );

        expect(result.result).toBe("MATCH");
    });

    it("marca MATCH cuando el área de la experiencia coincide", () => {
        const requirement = createExperienceRequirement(
            {
                type: "area",
                value: "web"
            },
            2
        );

        const result = matchExperienceRequirement(
            requirement,
            userProfileBase,
            "2026-01-01"
        );

        expect(result.result).toBe("MATCH");
    });

    it("marca MISSING cuando existe experiencia pero no alcanza el mínimo", () => {
        const requirement = createExperienceRequirement(
            {
                type: "technology",
                value: "JavaScript"
            },
            3
        );

        const result = matchExperienceRequirement(
            requirement,
            userProfileBase,
            "2026-01-01"
        );

        expect(result.result).toBe("MISSING");
    });

    it("marca MISSING cuando existe información de experiencia pero no coincide con el objetivo", () => {
        const requirement = createExperienceRequirement(
            {
                type: "technology",
                value: "Python"
            },
            1
        );

        const result = matchExperienceRequirement(
            requirement,
            userProfileBase,
            "2026-01-01"
        );

        expect(result.result).toBe("MISSING");
    });

    it("marca UNKNOWN cuando el perfil no contiene experiencias", () => {
        const profile: UserProfile = {
            ...userProfileBase,
            experiences: []
        };

        const requirement = createExperienceRequirement(
            {
                type: "technology",
                value: "Python"
            },
            1
        );

        const result = matchExperienceRequirement(
            requirement,
            profile,
            "2026-01-01"
        );

        expect(result.result).toBe("UNKNOWN");
    });

    it("no contabiliza experiencia personal para alcanzar los años mínimos", () => {
        const profile: UserProfile = {
            ...userProfileBase,
            experiences: [
                {
                    role: "WEB_DEVELOPER",
                    area: "web",
                    context: "Proyecto personal",
                    start: "2020-01-01",
                    end: "2025-01-01",
                    technologies: ["javascript"],
                    responsibilities: ["Desarrollo web"],
                    description: "Proyecto personal",
                    contextType: "PERSONAL"
                }
            ]
        };

        const requirement = createExperienceRequirement(
            {
                type: "technology",
                value: "JavaScript"
            },
            2
        );

        const result = matchExperienceRequirement(
            requirement,
            profile,
            "2026-01-01"
        );

        expect(result.result).toBe("MISSING");
    });

    it("usa referenceDate cuando la experiencia no tiene fecha de finalización", () => {
        const requirement = createExperienceRequirement(
            {
                type: "technology",
                value: "JavaScript"
            },
            2
        );

        const result = matchExperienceRequirement(
            requirement,
            userProfileBase,
            "2026-01-01"
        );

        expect(result.evidence.years).toBe(2);
    });

    it("no duplica años cuando dos experiencias se solapan", () => {
        const profile: UserProfile = {
            ...userProfileBase,
            experiences: [
                {
                    role: "WEB_DEVELOPER",
                    area: "web",
                    context: "Primera experiencia",
                    start: "2024-01-01",
                    end: "2025-01-01",
                    technologies: ["javascript"],
                    responsibilities: ["Desarrollo web"],
                    description: "Primera experiencia",
                    contextType: "PROFESSIONAL"
                },
                {
                    role: "WEB_DEVELOPER",
                    area: "web",
                    context: "Segunda experiencia",
                    start: "2024-07-01",
                    end: "2025-07-01",
                    technologies: ["javascript"],
                    responsibilities: ["Desarrollo web"],
                    description: "Segunda experiencia",
                    contextType: "PROFESSIONAL"
                }
            ]
        };

        const requirement = createExperienceRequirement(
            {
                type: "technology",
                value: "JavaScript"
            },
            2
        );

        const result = matchExperienceRequirement(
            requirement,
            profile,
            "2026-01-01"
        );

        expect(result.evidence.years).toBe(1.5);
        expect(result.result).toBe("MISSING");
    });

    it("no considera Java y JavaScript como la misma tecnología", () => {
        const requirement = createExperienceRequirement(
            {
                type: "technology",
                value: "Java"
            },
            1
        );

        const result = matchExperienceRequirement(
            requirement,
            userProfileBase,
            "2026-01-01"
        );

        expect(result.result).toBe("MISSING");
    });

    it("no falla cuando el área de una experiencia es null", () => {
        const profile: UserProfile = {
            ...userProfileBase,
            experiences: [
                {
                    ...userProfileBase.experiences[0],
                    area: null
                }
            ]
        };

        const requirement = createExperienceRequirement(
            {
                type: "area",
                value: "web"
            },
            1
        );

        const result = matchExperienceRequirement(
            requirement,
            profile,
            "2026-01-01"
        );

        expect(result.result).toBe("UNKNOWN");
    });

    it("rechaza un requisito que no sea una experiencia simple", () => {
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
            matchExperienceRequirement(
                requirement,
                userProfileBase,
                "2026-01-01"
            )
        ).toThrow();
    });

    it("evalúa una experiencia sin generar un requirementId", () => {
        const requirement = createExperienceRequirement(
            {
                type: "technology",
                value: "JavaScript"
            },
            2
        );

        const result = evaluateExperienceRequirement(
            requirement,
            userProfileBase,
            "2026-01-01"
        );

        expect(result).toEqual({
            result: "MATCH",
            evidence: {
                target: {
                    type: "technology",
                    value: "JavaScript"
                },
                minimumYears: 2,
                years: 2
            }
        });
    });
});