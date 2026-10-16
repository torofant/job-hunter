import { describe, expect, it } from "vitest";

import {
  composeAlternativeResult,
  composeGroupResult
} from "../../src/modules/jobs/requirement.composer.js";
import type { MatchEvaluation } from "../../src/modules/jobs/match-evaluation.js";

function createMatch(
  result: MatchEvaluation["result"]
): MatchEvaluation {
  return {
    result,
    evidence: {}
  };
}

describe("requirement composer", () => {
  describe("composeAlternativeResult", () => {
    it("devuelve MATCH cuando alguna opción coincide", () => {
      const result = composeAlternativeResult([
        createMatch("MISSING"),
        createMatch("MATCH"),
        createMatch("UNKNOWN")
      ]);

      expect(result).toBe("MATCH");
    });

    it("devuelve MISSING cuando todas las opciones faltan", () => {
      const result = composeAlternativeResult([
        createMatch("MISSING"),
        createMatch("MISSING")
      ]);

      expect(result).toBe("MISSING");
    });

    it("devuelve UNKNOWN cuando no hay coincidencias y existe información desconocida", () => {
      const result = composeAlternativeResult([
        createMatch("MISSING"),
        createMatch("UNKNOWN")
      ]);

      expect(result).toBe("UNKNOWN");
    });

    it("devuelve UNKNOWN cuando todas las opciones son desconocidas", () => {
      const result = composeAlternativeResult([
        createMatch("UNKNOWN"),
        createMatch("UNKNOWN")
      ]);

      expect(result).toBe("UNKNOWN");
    });

    it("rechaza una alternativa sin resultados", () => {
      expect(() => composeAlternativeResult([])).toThrow();
    });
  });

  describe("composeGroupResult", () => {
    it("devuelve MATCH cuando todos los componentes coinciden", () => {
      const result = composeGroupResult([
        createMatch("MATCH"),
        createMatch("MATCH")
      ]);

      expect(result).toBe("MATCH");
    });

    it("devuelve MISSING cuando todos los componentes faltan", () => {
      const result = composeGroupResult([
        createMatch("MISSING"),
        createMatch("MISSING")
      ]);

      expect(result).toBe("MISSING");
    });

    it("devuelve PARTIAL cuando algunos componentes coinciden y otros faltan", () => {
      const result = composeGroupResult([
        createMatch("MATCH"),
        createMatch("MISSING")
      ]);

      expect(result).toBe("PARTIAL");
    });

    it("devuelve MISSING cuando hay un componente que falta y otro desconocido", () => {
      const result = composeGroupResult([
        createMatch("MISSING"),
        createMatch("UNKNOWN")
      ]);

      expect(result).toBe("MISSING");
    });

    it("devuelve MISSING cuando hay coincidencias, componentes que faltan y desconocidos", () => {
      const result = composeGroupResult([
        createMatch("MATCH"),
        createMatch("MISSING"),
        createMatch("UNKNOWN")
      ]);

      expect(result).toBe("MISSING");
    });

    it("devuelve UNKNOWN cuando no falta ningún componente pero existe información desconocida", () => {
      const result = composeGroupResult([
        createMatch("MATCH"),
        createMatch("UNKNOWN")
      ]);

      expect(result).toBe("UNKNOWN");
    });

    it("rechaza un grupo sin resultados", () => {
      expect(() => composeGroupResult([])).toThrow();
    });
  });
});