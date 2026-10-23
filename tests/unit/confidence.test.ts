
import { describe, expect, it } from "vitest";

import {
  calculateConfidence,
  type ConfidenceInput
} from "../../src/modules/jobs/confidence.js";

describe("calculateConfidence", () => {
  const validInput: ConfidenceInput = {
    extractionStatus: "COMPLETED",
    hasDeterministicUnreliabilitySignal: false
  };

  it("devuelve MEDIUM cuando la extracción termina sin señales de fiabilidad insuficiente", () => {
    expect(calculateConfidence(validInput)).toBe("MEDIUM");
  });

  it("no devuelve HIGH aunque la extracción haya terminado correctamente", () => {
    expect(calculateConfidence(validInput)).not.toBe("HIGH");
  });

  it("devuelve LOW cuando existe una señal determinista de información poco fiable", () => {
    expect(
      calculateConfidence({
        ...validInput,
        hasDeterministicUnreliabilitySignal: true
      })
    ).toBe("LOW");
  });

  it("devuelve null cuando falla la extracción", () => {
    expect(
      calculateConfidence({
        ...validInput,
        extractionStatus: "FAILED"
      })
    ).toBeNull();
  });

  it("prioriza el fallo de extracción sobre una señal de información poco fiable", () => {
    expect(
      calculateConfidence({
        ...validInput,
        extractionStatus: "FAILED",
        hasDeterministicUnreliabilitySignal: true
      })
    ).toBeNull();
  });
});
