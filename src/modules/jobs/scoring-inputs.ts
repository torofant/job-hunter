import type { InferSelectModel } from "drizzle-orm";
import { jobOffers } from "../../database/schema/index.js";
import type { Requirement } from "./requirement.js";
import type { RequirementMatch } from "./requirement-match.js";
import type { ScoringInputs } from "./scoring.js";
import type { UserProfile } from "./user-profile.js";
import { matchSalary } from "./salary-matcher.js";

type JobOffer = InferSelectModel<typeof jobOffers>;
type MatchResult = RequirementMatch["result"];
type ExperienceScope = "general" | "specific" | "ambiguous";

function matchJobTarget(
    offerValue: string,
    profileValues: string[]
): MatchResult {
    if (offerValue === "UNKNOWN" || profileValues.length === 0) {
        return "UNKNOWN";
    }

    const knownValues = profileValues.filter(
        (value) => value !== "UNKNOWN" && value !== "OTHER"
    );

    if (knownValues.length === 0) {
        return "UNKNOWN";
    }

    return knownValues.includes(offerValue) ? "MATCH" : "MISSING";
}

function scoreModality(
    modality: JobOffer["modality"],
    userProfile: UserProfile
): MatchResult {
    switch (modality) {
        case "REMOTE":
            return userProfile.locationPreferences.remoteAllowed
                ? "MATCH"
                : "MISSING";

        case "HYBRID":
            return userProfile.locationPreferences.hybridAllowed
                ? "MATCH"
                : "MISSING";

        case "ONSITE":
            return userProfile.locationPreferences.onsiteAllowed
                ? "MATCH"
                : "MISSING";

        case "UNKNOWN":
            return "UNKNOWN";
    }
}


function scoreLocalityPoints(jobOffer: JobOffer): number | null {
    if (jobOffer.modality === "REMOTE") {
        return jobOffer.country === "Spain" ? 5 : null;
    }

    if (!jobOffer.city || jobOffer.city === "UNKNOWN") {
        return null;
    }

    if (jobOffer.city === "Castellón") {
        return 5;
    }

    if (jobOffer.modality === "HYBRID" && jobOffer.city === "Valencia") {
        return 4;
    }

    if (jobOffer.distanceKm === null) {
        return null;
    }

    if (jobOffer.distanceKm <= 25) {
        return 4;
    }

    if (jobOffer.distanceKm <= 50) {
        return 3;
    }

    if (jobOffer.distanceKm <= 75) {
        return 2;
    }

    return 0;
}

function scoreLocality(jobOffer: JobOffer): MatchResult {
    const points = scoreLocalityPoints(jobOffer);

    if (points === null) {
        return "UNKNOWN";
    }

    if (points >= 5) {
        return "MATCH";
    }

    if (points > 0) {
        return "PARTIAL";
    }

    return "MISSING";
}


function scoreContract(jobOffer: JobOffer): MatchResult {
    switch (jobOffer.contract) {
        case "PERMANENT":
            return "MATCH";

        case "TEMPORARY":
            // M0.11 lo considera un filtro excluyente.
            // El scoring no debe crear una regla de rechazo nueva.
            return "MISSING";

        case "UNKNOWN":
            return "UNKNOWN";
    }
}

function scoreWorkingHours(jobOffer: JobOffer): MatchResult {
    switch (jobOffer.workingHours) {
        case "FULL_TIME":
            return "MATCH";

        case "PART_TIME":
            return "PARTIAL";

        case "UNKNOWN":
            return "UNKNOWN";
    }
}

function getExperienceTargetTypes(
    requirement: Extract<Requirement, { category: "experience" }>
): Array<"technology" | "role" | "area"> {
    switch (requirement.type) {
        case "single":
            return [requirement.data.target.type];

        case "alternative":
            return requirement.data.options.map((option) => option.target.type);

        case "group":
            return requirement.data.components.map((component) => component.target.type);
    }
}

function classifyExperience(
    requirement: Extract<Requirement, { category: "experience" }>
): ExperienceScope {
    const targetTypes = getExperienceTargetTypes(requirement);

    if (targetTypes.every((type) => type === "technology")) {
        return "specific";
    }

    if (targetTypes.every((type) => type === "role" || type === "area")) {
        return "general";
    }

    return "ambiguous";
}

export function buildScoringInputs(input: {
    jobOffer: JobOffer;
    userProfile: UserProfile;
    requirements: Requirement[];
    matches: RequirementMatch[];
    salaryMetadata?: Record<string, unknown> | null;
}): ScoringInputs {
    const {
        jobOffer,
        userProfile,
        requirements,
        matches,
        salaryMetadata
    } = input;

    const matchesById = new Map(
        matches.map((match) => [match.requirementId, match])
    );

    function resultFor(requirement: Requirement): MatchResult {
        return matchesById.get(requirement.id)?.result ?? "UNKNOWN";
    }

    const targetRoles = userProfile.targetRoles;

    const familyResult = matchJobTarget(
        jobOffer.jobFamily,
        targetRoles.map((target) => target.family)
    );

    const roleResult = matchJobTarget(
        jobOffer.role,
        targetRoles.map((target) => target.role)
    );

    const technologies = requirements.filter(
        (requirement) => requirement.category === "technology"
    );

    const experiences = requirements.filter(
        (requirement) => requirement.category === "experience"
    );

    const languages = requirements.filter(
        (requirement) => requirement.category === "language"
    );

    const otherRequirements = requirements.filter(
        (requirement) => requirement.category === "other"
    );

    const generalExperience: MatchResult[] = [];
    const specificExperience: MatchResult[] = [];

    for (const requirement of experiences) {
        const scope = classifyExperience(requirement);
        const result = resultFor(requirement);

        if (scope === "general") {
            generalExperience.push(result);
        } else if (scope === "specific") {
            specificExperience.push(result);
        } else {
            // Un requisito mixto o ambiguo no se asigna arbitrariamente
            // a una categoría de experiencia.
            generalExperience.push("UNKNOWN");
            specificExperience.push("UNKNOWN");
        }
    }

    return {
        jobType: {
            family: familyResult,
            role: roleResult
        },
        technologies: {
            required: technologies
                .filter((requirement) => requirement.importance === "required")
                .map(resultFor),
            preferred: technologies
                .filter((requirement) => requirement.importance === "preferred")
                .map(resultFor)
        },
        experience: {
            general: generalExperience,
            specific: specificExperience
        },
        // Se completarán en el siguiente bloque con las reglas M0.11.
        location: {
            modality: scoreModality(jobOffer.modality, userProfile),
            locality: scoreLocality(jobOffer),
            localityPoints: scoreLocalityPoints(jobOffer)
        },
        employmentConditions: {
            salary: matchSalary(salaryMetadata, userProfile.salaryPreferences),
            contract: scoreContract(jobOffer),
            workingHours: scoreWorkingHours(jobOffer)
        },
        languages: languages.map(resultFor),
        otherRequirements: otherRequirements.map(resultFor)
    };
}