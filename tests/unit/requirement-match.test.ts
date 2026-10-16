import { describe, expect, it } from "vitest";

import {
  requirementMatchResultSchema,
  requirementMatchSchema
} from "../../src/modules/jobs/requirement-match.js";

describe("requirementMatchSchema", () => {
  it("acepta un match válido", () => {
    const result = requirementMatchSchema.safeParse({
      requirementId: "550e8400-e29b-41d4-a716-446655440000",
      result: "MATCH",
      evidence: {
        technology: "javascript"
      }
    });

    expect(result.success).toBe(true);
  });

  it("acepta todos los resultados de Matching", () => {
    for (const result of [
      "MATCH",
      "PARTIAL",
      "MISSING",
      "UNKNOWN",
      "N/A"
    ]) {
      expect(requirementMatchResultSchema.safeParse(result).success).toBe(
        true
      );
    }
  });

  it("rechaza un resultado desconocido", () => {
    const result = requirementMatchResultSchema.safeParse("INVALID");

    expect(result.success).toBe(false);
  });

  it("rechaza un requirementId inválido", () => {
    const result = requirementMatchSchema.safeParse({
      requirementId: "not-a-uuid",
      result: "MATCH",
      evidence: {}
    });

    expect(result.success).toBe(false);
  });

  it("requiere evidence", () => {
    const result = requirementMatchSchema.safeParse({
      requirementId: "550e8400-e29b-41d4-a716-446655440000",
      result: "UNKNOWN"
    });

    expect(result.success).toBe(false);
  });
});