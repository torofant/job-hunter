
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type ConfidenceInput = {
  extractionStatus: "COMPLETED" | "FAILED";
  hasDeterministicUnreliabilitySignal: boolean;
};

export function calculateConfidence(
  input: ConfidenceInput
): ConfidenceLevel | null {
  // Una extracción fallida no produce una confianza final.
  if (input.extractionStatus === "FAILED") {
    return null;
  }

  // LOW requiere una señal determinista explícita.
  if (input.hasDeterministicUnreliabilitySignal) {
    return "LOW";
  }

  // HIGH queda deshabilitado hasta implementar y verificar
  // un validador determinista de suficiencia y coherencia.
  return "MEDIUM";
}
