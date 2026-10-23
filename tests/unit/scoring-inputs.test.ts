import { describe, expect, it } from "vitest";
import {
    buildScoringInputs
} from "../../src/modules/jobs/scoring-inputs.js";
import type { Requirement } from "../../src/modules/jobs/requirement.js";
import type { RequirementMatch } from "../../src/modules/jobs/requirement-match.js";
import type { UserProfile } from "../../src/modules/jobs/user-profile.js";
import type { InferSelectModel } from "drizzle-orm";
import { jobOffers } from "../../src/database/schema/index.js";

type JobOffer = InferSelectModel<typeof jobOffers>;

const ids = {
    technologyRequired: "00000000-0000-4000-8000-000000000001",
    technologyPreferred: "00000000-0000-4000-8000-000000000002",
    experienceGeneral: "00000000-0000-4000-8000-000000000003",
    experienceSpecific: "00000000-0000-4000-8000-000000000004",
    experienceAmbiguous: "00000000-0000-4000-8000-000000000005"
};

const jobOffer = {
    id: "10000000-0000-4000-8000-000000000001",
    source: "test",
    sourceJobId: null,
    normalizedUrl: null,
    title: "Developer",
    company: "Test",
    jobFamily: "SOFTWARE",
    role: "BACKEND_DEVELOPER",
    country: "Spain",
    city: "Castellón",
    modality: "REMOTE",
    distanceKm: null,
    contract: "PERMANENT",
    employmentType: "EMPLOYEE",
    workingHours: "FULL_TIME"
} as JobOffer;

const userProfile = {
    id: "20000000-0000-4000-8000-000000000001",
    targetRoles: [
        {
            family: "SOFTWARE",
            role: "BACKEND_DEVELOPER",
            priorityOrder: 10
        },
        {
            family: "WEB",
            role: "FRONTEND_DEVELOPER",
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
        partTimeAllowed: true,
        permanentAllowed: true,
        temporaryAllowed: true,
        internshipAllowed: true,
        scholarshipAllowed: true,
        traineeAllowed: true,
        freelanceAllowed: true,
        selfEmployedAllowed: true
    },
    salaryPreferences: {
        currency: "EUR",
        minimum: 20000,
        desired: 24000
    }
} as UserProfile;

function requirement(
    id: string,
    category: "technology" | "experience",
    importance: "required" | "preferred",
    data: unknown,
    type: "single" | "alternative" | "group" = "single"
): Requirement {
    return {
        id,
        category,
        importance,
        type,
        data
    } as Requirement;
}

function match(id: string, result: RequirementMatch["result"]): RequirementMatch {
    return {
        requirementId: id,
        result,
        evidence: {}
    };
}

function build(
    requirements: Requirement[],
    matches: RequirementMatch[],
    profile: UserProfile = userProfile
) {
    return buildScoringInputs({
        jobOffer,
        userProfile: profile,
        requirements,
        matches
    });
}

describe("buildScoringInputs", () => {
    it("evalúa familia y rol independientemente de priorityOrder", () => {
        const result = build([], []);

        expect(result.jobType).toEqual({
            family: "MATCH",
            role: "MATCH"
        });

        const profileWithDifferentPriorities = {
            ...userProfile,
            targetRoles: userProfile.targetRoles.map((target) => ({
                ...target,
                priorityOrder: 100 - target.priorityOrder
            }))
        };

        expect(
            build([], [], profileWithDifferentPriorities).jobType
        ).toEqual(result.jobType);
    });

    it("marca como MISSING los objetivos conocidos sin coincidencia", () => {
        const profile = {
            ...userProfile,
            targetRoles: [
                {
                    family: "WEB",
                    role: "FRONTEND_DEVELOPER",
                    priorityOrder: 0
                }
            ]
        } as UserProfile;

        expect(build([], [], profile).jobType).toEqual({
            family: "MISSING",
            role: "MISSING"
        });
    });

    it("separa tecnologías requeridas y preferidas", () => {
        const requirements = [
            requirement(
                ids.technologyRequired,
                "technology",
                "required",
                { technology: "TypeScript" }
            ),
            requirement(
                ids.technologyPreferred,
                "technology",
                "preferred",
                { technology: "React" }
            )
        ];

        const result = build(requirements, [
            match(ids.technologyRequired, "MATCH"),
            match(ids.technologyPreferred, "PARTIAL")
        ]);

        expect(result.technologies).toEqual({
            required: ["MATCH"],
            preferred: ["PARTIAL"]
        });
    });

    it("clasifica role como experiencia general y technology como específica", () => {
        const requirements = [
            requirement(
                ids.experienceGeneral,
                "experience",
                "required",
                {
                    target: {
                        type: "role",
                        value: "BACKEND_DEVELOPER"
                    },
                    minimumYears: 2
                }
            ),
            requirement(
                ids.experienceSpecific,
                "experience",
                "required",
                {
                    target: {
                        type: "technology",
                        value: "TypeScript"
                    },
                    minimumYears: 2
                }
            )
        ];

        const result = build(requirements, [
            match(ids.experienceGeneral, "MATCH"),
            match(ids.experienceSpecific, "MISSING")
        ]);

        expect(result.experience).toEqual({
            general: ["MATCH"],
            specific: ["MISSING"]
        });
    });

    it("no asigna arbitrariamente un requisito mixto a una sola categoría", () => {
        const requirements = [
            requirement(
                ids.experienceAmbiguous,
                "experience",
                "required",
                {
                    options: [
                        {
                            target: {
                                type: "role",
                                value: "BACKEND_DEVELOPER"
                            },
                            minimumYears: 2
                        },
                        {
                            target: {
                                type: "technology",
                                value: "TypeScript"
                            },
                            minimumYears: 2
                        }
                    ]
                },
                "alternative"
            )
        ];

        const result = build(requirements, [
            match(ids.experienceAmbiguous, "MATCH")
        ]);

        expect(result.experience).toEqual({
            general: ["UNKNOWN"],
            specific: ["UNKNOWN"]
        });
    });

    it("devuelve UNKNOWN si no hay objetivos de perfil evaluables", () => {
        const profile = {
            ...userProfile,
            targetRoles: []
        } as UserProfile;

        expect(build([], [], profile).jobType).toEqual({
            family: "UNKNOWN",
            role: "UNKNOWN"
        });
    });

    it("marca como UNKNOWN la modalidad cuando la oferta no la especifica", () => {
        const inputs = buildScoringInputs({
            jobOffer: { ...jobOffer, modality: "UNKNOWN" } as JobOffer,
            userProfile,
            requirements: [],
            matches: []
        });

        expect(inputs.location.modality).toBe("UNKNOWN");
    });

    it("marca como UNKNOWN el salario porque la oferta no tiene ese dato", () => {
        const inputs = build([], []);

        expect(inputs.employmentConditions.salary).toBe("UNKNOWN");
    });

    it("reconoce una jornada completa como MATCH", () => {
        const inputs = buildScoringInputs({
            jobOffer: { ...jobOffer, workingHours: "FULL_TIME" } as JobOffer,
            userProfile,
            requirements: [],
            matches: []
        });

        expect(inputs.employmentConditions.workingHours).toBe("MATCH");
    });

    it("reconoce una jornada parcial como PARTIAL", () => {
        const inputs = buildScoringInputs({
            jobOffer: { ...jobOffer, workingHours: "PART_TIME" } as JobOffer,
            userProfile,
            requirements: [],
            matches: []
        });

        expect(inputs.employmentConditions.workingHours).toBe("PARTIAL");
    });

    it("mantiene UNKNOWN cuando se desconoce el contrato", () => {
        const inputs = buildScoringInputs({
            jobOffer: { ...jobOffer, contract: "UNKNOWN" } as JobOffer,
            userProfile,
            requirements: [],
            matches: []
        });

        expect(inputs.employmentConditions.contract).toBe("UNKNOWN");
    });

    it("reconoce un contrato permanente como MATCH", () => {
        const inputs = build([], []);

        expect(inputs.employmentConditions.contract).toBe("MATCH");
    });

    it("asigna 5 puntos a una oferta remota en España", () => {
        const inputs = buildScoringInputs({
            jobOffer: { ...jobOffer, modality: "REMOTE", country: "Spain" } as JobOffer,
            userProfile,
            requirements: [],
            matches: []
        });

        expect(inputs.location.localityPoints).toBe(5);
    });

    it("asigna 5 puntos a una oferta presencial en Castellón", () => {
        const inputs = buildScoringInputs({
            jobOffer: {
                ...jobOffer,
                modality: "ONSITE",
                country: "Spain",
                city: "Castellón",
                distanceKm: null
            } as JobOffer,
            userProfile,
            requirements: [],
            matches: []
        });

        expect(inputs.location.localityPoints).toBe(5);
    });

    it("asigna 4 puntos a una oferta híbrida en Valencia", () => {
        const inputs = buildScoringInputs({
            jobOffer: {
                ...jobOffer,
                modality: "HYBRID",
                country: "Spain",
                city: "Valencia",
                distanceKm: null
            } as JobOffer,
            userProfile,
            requirements: [],
            matches: []
        });

        expect(inputs.location.localityPoints).toBe(4);
    });

    it.each([
        [25, 4],
        [50, 3],
        [75, 2]
    ])("asigna %i km a la puntuación de localidad esperada", (distanceKm, expectedPoints) => {
        const inputs = buildScoringInputs({
            jobOffer: {
                ...jobOffer,
                modality: "ONSITE",
                country: "Spain",
                city: "Otra ciudad",
                distanceKm
            } as JobOffer,
            userProfile,
            requirements: [],
            matches: []
        });

        expect(inputs.location.localityPoints).toBe(expectedPoints);
    });

    it("devuelve null si la localidad no puede evaluarse", () => {
        const inputs = buildScoringInputs({
            jobOffer: {
                ...jobOffer,
                modality: "ONSITE",
                city: "UNKNOWN",
                distanceKm: null
            } as JobOffer,
            userProfile,
            requirements: [],
            matches: []
        });

        expect(inputs.location.localityPoints).toBeNull();
        expect(inputs.location.locality).toBe("UNKNOWN");
    });
});