import type { UserProfile } from "./user-profile.js";
import type { WeightedMatchingResult } from "./scoring.js";

type SalaryMatchResult = WeightedMatchingResult["result"];

type SalaryMetadata = Record<string, unknown>;

function parseSalaryAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  // Solo aceptamos cadenas numéricas sin separadores ambiguos.
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    const amount = Number(value);

    return Number.isFinite(amount) ? amount : null;
  }

  return null;
}

function isSupportedCurrency(value: unknown): boolean {
  return (
    typeof value === "string" &&
    ["EUR", "€"].includes(value.trim().toUpperCase())
  );
}

function isAnnualPeriod(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();

  return [
    "annual",
    "annually",
    "year",
    "yearly",
    "per_year",
    "anual",
    "anualmente",
    "por_año",
    "por año"
  ].includes(normalized);
}

export function matchSalary(
  metadata: SalaryMetadata | null | undefined,
  preferences: UserProfile["salaryPreferences"]
): SalaryMatchResult {
  if (!metadata) {
    return "UNKNOWN";
  }

  // No convertimos monedas ni asumimos periodicidades.
  if (
    preferences.currency !== "EUR" ||
    !isSupportedCurrency(metadata.salary_currency) ||
    !isAnnualPeriod(metadata.salary_period)
  ) {
    return "UNKNOWN";
  }

  const minimum = parseSalaryAmount(preferences.minimum);
  const desired = parseSalaryAmount(preferences.desired);

  if (minimum === null || desired === null || desired < minimum) {
    return "UNKNOWN";
  }

  const hasRange =
    metadata.salary_min !== undefined ||
    metadata.salary_max !== undefined;

  let salary: number | null;

  if (hasRange) {
    // La regla del proyecto compara el extremo inferior del rango.
    salary = parseSalaryAmount(metadata.salary_min);
  } else {
    salary = parseSalaryAmount(metadata.salary);
  }

  if (salary === null) {
    return "UNKNOWN";
  }

  if (salary < minimum) {
    return "MISSING";
  }

  if (salary < desired) {
    return "PARTIAL";
  }

  return "MATCH";
}