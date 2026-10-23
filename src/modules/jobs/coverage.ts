
export type CoverageLevel = "FULL" | "LIMITED" | "UNKNOWN" | "N/A";

export type CoverageValue = 100 | 50 | 0 | null;

export type WeightedCoverageInput = {
  level: CoverageLevel;
  weight: number;
};

export type CoverageCategory =
  | "job_type"
  | "technologies"
  | "experience"
  | "location"
  | "employment_conditions"
  | "languages"
  | "other_requirements";

export const COVERAGE_CATEGORIES: CoverageCategory[] = [
  "job_type",
  "technologies",
  "experience",
  "location",
  "employment_conditions",
  "languages",
  "other_requirements"
];

export type CoverageBreakdown = Record<
  CoverageCategory,
  number | null
>;

export type CoverageCategoryInput = Record<
  CoverageCategory,
  WeightedCoverageInput[]
>;

type WeightedValueInput = {
  value: number | null;
  weight: number;
};

/**
 * Convierte un nivel de Coverage en su valor numérico.
 * N/A queda excluido de los cálculos.
 */
export function coverageLevelToValue(
  level: CoverageLevel
): CoverageValue {
  switch (level) {
    case "FULL":
      return 100;
    case "LIMITED":
      return 50;
    case "UNKNOWN":
      return 0;
    case "N/A":
      return null;
  }
}

/**
 * Calcula una media ponderada excluyendo valores N/A
 * del numerador y del denominador.
 */
function calculateWeightedValue(
  items: WeightedValueInput[]
): number | null {
  const evaluableItems = items.filter(
    (item) => item.value !== null
  );

  const totalWeight = evaluableItems.reduce(
    (total, item) => total + item.weight,
    0
  );

  if (totalWeight <= 0) {
    return null;
  }

  const weightedTotal = evaluableItems.reduce(
    (total, item) =>
      total + item.weight * item.value!,
    0
  );

  return weightedTotal / totalWeight;
}

/**
 * Calcula Coverage a partir de niveles con pesos explícitos.
 */
export function calculateCoverageScore(
  items: WeightedCoverageInput[]
): number | null {
  return calculateWeightedValue(
    items.map((item) => ({
      value: coverageLevelToValue(item.level),
      weight: item.weight
    }))
  );
}

/**
 * Combina familia y rol con los pesos acordados: 40/60.
 */
export function calculateFamilyRoleCoverage(
  family: CoverageLevel,
  role: CoverageLevel
): number | null {
  return calculateCoverageScore([
    { level: family, weight: 40 },
    { level: role, weight: 60 }
  ]);
}

/**
 * Calcula Coverage de una categoría de requisitos.
 *
 * Cada requisito tiene el mismo peso dentro de su grupo.
 * Los grupos required y preferred pesan 70/30.
 * Si un grupo no tiene información evaluable, se excluye
 * y se renormaliza el peso del grupo restante.
 */
export function calculateRequirementCoverage(
  required: CoverageLevel[],
  preferred: CoverageLevel[]
): number | null {
  const requiredScore = calculateCoverageScore(
    required.map((level) => ({ level, weight: 1 }))
  );

  const preferredScore = calculateCoverageScore(
    preferred.map((level) => ({ level, weight: 1 }))
  );

  return calculateWeightedValue([
    { value: requiredScore, weight: 70 },
    { value: preferredScore, weight: 30 }
  ]);
}

/**
 * Calcula el desglose por categoría.
 *
 * Los pesos de cada elemento deben prepararse antes de llamar
 * a esta función, usando las reglas correspondientes a su categoría.
 */
export function calculateCoverageBreakdown(
  inputs: CoverageCategoryInput
): CoverageBreakdown {
  return {
    job_type: calculateCoverageScore(inputs.job_type),
    technologies: calculateCoverageScore(inputs.technologies),
    experience: calculateCoverageScore(inputs.experience),
    location: calculateCoverageScore(inputs.location),
    employment_conditions: calculateCoverageScore(
      inputs.employment_conditions
    ),
    languages: calculateCoverageScore(inputs.languages),
    other_requirements: calculateCoverageScore(
      inputs.other_requirements
    )
  };
}

/**
 * Pesos de categoría para el Coverage global.
 * Se reutilizan los pesos de categoría definidos para Scoring,
 * pero Coverage continúa siendo una métrica independiente.
 */
export const COVERAGE_CATEGORY_WEIGHTS: Record<
  CoverageCategory,
  number
> = {
  job_type: 20,
  technologies: 25,
  experience: 20,
  location: 15,
  employment_conditions: 10,
  languages: 5,
  other_requirements: 5
};

/**
 * Agrega el desglose en un Coverage global.
 * Las categorías null se excluyen y los pesos restantes
 * se normalizan automáticamente.
 */
export function calculateGlobalCoverageScore(
  breakdown: CoverageBreakdown
): number | null {
  return calculateWeightedValue(
    COVERAGE_CATEGORIES.map((category) => ({
      value: breakdown[category],
      weight: COVERAGE_CATEGORY_WEIGHTS[category]
    }))
  );
}
