import { describe, expect, it } from "vitest";
import { matchingSummarySchema } from "../../src/modules/jobs/matching-summary.js";
import type { Requirement } from "../../src/modules/jobs/requirement.js";
import type { RequirementMatch } from "../../src/modules/jobs/requirement-match.js";
import { buildMatchingSummary } from "../../src/modules/jobs/matching-summary.js";

function createRequirement(
  importance: "required" | "preferred",
  id: string
): Requirement {
  return {
    id,
    importance,
    category: "technology",
    type: "single",
    data: { technology: "JavaScript" }
  };
}

function createMatch(
  requirementId: string,
  result: RequirementMatch["result"]
): RequirementMatch {
  return {
    requirementId,
    result,
    evidence: {}
  };
}

describe("matchingSummarySchema", () => {
  it("acepta un resumen válido", () => {
    const result = matchingSummarySchema.safeParse({
      required: {
        total: 3,
        evaluated: 3,
        match: 2,
        partial: 0,
        missing: 1,
        unknown: 0,
        notApplicable: 0,
        compliance: 2 / 3,
        hasMissing: true
      },
      preferred: {
        total: 2,
        evaluated: 1,
        match: 1,
        partial: 0,
        missing: 0,
        unknown: 1,
        notApplicable: 0,
        compliance: 1
      }
    });

    expect(result.success).toBe(true);
  });

  it("acepta compliance null cuando no hay requisitos evaluables", () => {
    const result = matchingSummarySchema.safeParse({
      required: {
        total: 0,
        evaluated: 0,
        match: 0,
        partial: 0,
        missing: 0,
        unknown: 0,
        notApplicable: 0,
        compliance: null,
        hasMissing: false
      },
      preferred: {
        total: 0,
        evaluated: 0,
        match: 0,
        partial: 0,
        missing: 0,
        unknown: 0,
        notApplicable: 0,
        compliance: null
      }
    });

    expect(result.success).toBe(true);
  });

  it("rechaza compliance fuera del rango", () => {
    const result = matchingSummarySchema.safeParse({
      required: {
        total: 1,
        evaluated: 1,
        match: 1,
        partial: 0,
        missing: 0,
        unknown: 0,
        notApplicable: 0,
        compliance: 2,
        hasMissing: false
      },
      preferred: {
        total: 0,
        evaluated: 0,
        match: 0,
        partial: 0,
        missing: 0,
        unknown: 0,
        notApplicable: 0,
        compliance: null
      }
    });

    expect(result.success).toBe(false);
  });
});

describe("buildMatchingSummary", () => {
  it("calcula el cumplimiento excluyendo UNKNOWN y N/A", () => {
    const results = [
      {
        requirement: createRequirement(
          "required",
          "550e8400-e29b-41d4-a716-446655440001"
        ),
        match: createMatch(
          "550e8400-e29b-41d4-a716-446655440001",
          "MATCH"
        )
      },
      {
        requirement: createRequirement(
          "required",
          "550e8400-e29b-41d4-a716-446655440002"
        ),
        match: createMatch(
          "550e8400-e29b-41d4-a716-446655440002",
          "PARTIAL"
        )
      },
      {
        requirement: createRequirement(
          "required",
          "550e8400-e29b-41d4-a716-446655440003"
        ),
        match: createMatch(
          "550e8400-e29b-41d4-a716-446655440003",
          "MISSING"
        )
      },
      {
        requirement: createRequirement(
          "required",
          "550e8400-e29b-41d4-a716-446655440004"
        ),
        match: createMatch(
          "550e8400-e29b-41d4-a716-446655440004",
          "UNKNOWN"
        )
      },
      {
        requirement: createRequirement(
          "required",
          "550e8400-e29b-41d4-a716-446655440005"
        ),
        match: createMatch(
          "550e8400-e29b-41d4-a716-446655440005",
          "N/A"
        )
      }
    ];

    const summary = buildMatchingSummary(results);

    expect(summary.required).toMatchObject({
      total: 5,
      evaluated: 3,
      match: 1,
      partial: 1,
      missing: 1,
      unknown: 1,
      notApplicable: 1,
      compliance: (1 + 0.7) / 3,
      hasMissing: true
    });
  });

  it("devuelve compliance null cuando no hay resultados evaluables", () => {
    const id = "550e8400-e29b-41d4-a716-446655440006";

    const summary = buildMatchingSummary([
      {
        requirement: createRequirement("preferred", id),
        match: createMatch(id, "UNKNOWN")
      }
    ]);

    expect(summary.preferred.evaluated).toBe(0);
    expect(summary.preferred.compliance).toBeNull();
  });

  it("separa los requisitos obligatorios de los preferidos", () => {
    const requiredId = "550e8400-e29b-41d4-a716-446655440007";
    const preferredId = "550e8400-e29b-41d4-a716-446655440008";

    const summary = buildMatchingSummary([
      {
        requirement: createRequirement("required", requiredId),
        match: createMatch(requiredId, "MISSING")
      },
      {
        requirement: createRequirement("preferred", preferredId),
        match: createMatch(preferredId, "MATCH")
      }
    ]);

    expect(summary.required.hasMissing).toBe(true);
    expect(summary.required.compliance).toBe(0);
    expect(summary.preferred.compliance).toBe(1);
    expect(summary.preferred).not.toHaveProperty("hasMissing");
  });

  it("devuelve grupos vacíos cuando no hay requisitos", () => {
    const summary = buildMatchingSummary([]);

    expect(summary.required.total).toBe(0);
    expect(summary.required.compliance).toBeNull();
    expect(summary.required.hasMissing).toBe(false);
    expect(summary.preferred.total).toBe(0);
    expect(summary.preferred.compliance).toBeNull();
  });
});