
import { z } from "zod";

export const scoringCategorySchema = z.enum([
  "HIGH_MATCH",
  "GOOD_MATCH",
  "POSSIBLE_MATCH",
  "LOW_MATCH"
]);

export const scoringBreakdownSchema = z.object({
  jobType: z.number().min(0).max(20).nullable(),
  technologies: z.number().min(0).max(25).nullable(),
  experience: z.number().min(0).max(20).nullable(),
  location: z.number().min(0).max(15).nullable(),
  employmentConditions: z.number().min(0).max(10).nullable(),
  languages: z.number().min(0).max(5).nullable(),
  otherRequirements: z.number().min(0).max(5).nullable()
});

export const scoringResultSchema = z.object({
  score: z.number().min(0).max(100).nullable(),
  category: scoringCategorySchema.nullable(),
  breakdown: scoringBreakdownSchema
});

export type ScoringCategory = z.infer<
  typeof scoringCategorySchema
>;

export type ScoringBreakdown = z.infer<
  typeof scoringBreakdownSchema
>;

export type ScoringResult = z.infer<
  typeof scoringResultSchema
>;

export function matchingResultToScore(
  result: "MATCH" | "PARTIAL" | "MISSING" | "UNKNOWN" | "N/A"
): number | null {
  switch (result) {
    case "MATCH":
      return 1;

    case "PARTIAL":
      return 0.7;

    case "MISSING":
      return 0;

    case "UNKNOWN":
    case "N/A":
      return null;
  }
}

export function calculateWeightedContribution(
  results: WeightedMatchingResult[],
  categoryWeight: number
): number | null {
  const evaluableResults = results.filter(
    (item) => matchingResultToScore(item.result) !== null
  );

  const totalEvaluableWeight = evaluableResults.reduce(
    (total, item) => total + item.weight,
    0
  );

  if (totalEvaluableWeight === 0) {
    return null;
  }

  const weightedScore = evaluableResults.reduce(
    (total, item) =>
      total +
      item.weight * (matchingResultToScore(item.result) ?? 0),
    0
  );

  return (weightedScore / totalEvaluableWeight) * categoryWeight;
}


export function calculateOriginalScaleContribution(
  results: WeightedMatchingResult[]
): number | null {
  let total: number | null = null;

  for (const item of results) {
    const value =
      item.scoreOverride !== undefined
        ? item.scoreOverride
        : matchingResultToScore(item.result);

    if (value === null) {
      continue;
    }

    total = (total ?? 0) + item.weight * value;
  }

  return total;
}

export type WeightedMatchingResult = {
  weight: number;
  result: "MATCH" | "PARTIAL" | "MISSING" | "UNKNOWN" | "N/A";
  scoreOverride?: number | null;
};

export type ScoringInputs = {
  jobType: {
    family: WeightedMatchingResult["result"];
    role: WeightedMatchingResult["result"];
  };
  technologies: {
    required: WeightedMatchingResult["result"][];
    preferred: WeightedMatchingResult["result"][];
  };
  experience: {
    general: WeightedMatchingResult["result"][];
    specific: WeightedMatchingResult["result"][];
  };
  location: {
    modality: WeightedMatchingResult["result"];
    locality: WeightedMatchingResult["result"];
    localityPoints?: number | null;
  };
  employmentConditions: {
    salary: WeightedMatchingResult["result"];
    contract: WeightedMatchingResult["result"];
    workingHours: WeightedMatchingResult["result"];
  };
  languages: WeightedMatchingResult["result"][];
  otherRequirements: WeightedMatchingResult["result"][];
};

export function calculateWeightedScore(
  results: WeightedMatchingResult[]
): number | null {
  const getScore = (item: WeightedMatchingResult): number | null =>
    item.scoreOverride !== undefined
      ? item.scoreOverride
      : matchingResultToScore(item.result);

  const evaluableResults = results.filter(
    (item) => getScore(item) !== null
  );

  const totalEvaluableWeight = evaluableResults.reduce(
    (total, item) => total + item.weight,
    0
  );

  if (totalEvaluableWeight === 0) {
    return null;
  }

  const weightedScore = evaluableResults.reduce(
    (total, item) => total + item.weight * (getScore(item) ?? 0),
    0
  );

  return (weightedScore / totalEvaluableWeight) * 100;
}

function toWeightedResults(
  results: WeightedMatchingResult["result"][],
  totalWeight: number
): WeightedMatchingResult[] {
  if (results.length === 0) {
    return [];
  }

  const weightPerResult = totalWeight / results.length;

  return results.map((result) => ({
    result,
    weight: weightPerResult
  }));
}

export function calculateScoringResult(
  inputs: ScoringInputs
): ScoringResult {
  const jobTypeResults: WeightedMatchingResult[] = [
    { result: inputs.jobType.family, weight: 8 },
    { result: inputs.jobType.role, weight: 12 }
  ];

  const technologyResults = [
    ...toWeightedResults(inputs.technologies.required, 17.5),
    ...toWeightedResults(inputs.technologies.preferred, 7.5)
  ];

  const experienceResults = [
    ...toWeightedResults(inputs.experience.general, 10),
    ...toWeightedResults(inputs.experience.specific, 10)
  ];

    const locationResults: WeightedMatchingResult[] = [
    { result: inputs.location.modality, weight: 10 },
    {
      result: inputs.location.locality,
      weight: 5,
      scoreOverride:
        inputs.location.localityPoints === undefined ||
        inputs.location.localityPoints === null
          ? undefined
          : Math.max(0, Math.min(5, inputs.location.localityPoints)) / 5
    }
  ];

  const employmentResults: WeightedMatchingResult[] = [
    { result: inputs.employmentConditions.salary, weight: 5 },
    { result: inputs.employmentConditions.contract, weight: 3 },
    { result: inputs.employmentConditions.workingHours, weight: 2 }
  ];

  const languageResults = toWeightedResults(inputs.languages, 5);
  const otherResults = toWeightedResults(inputs.otherRequirements, 5);

  const allResults = [
    ...jobTypeResults,
    ...technologyResults,
    ...experienceResults,
    ...locationResults,
    ...employmentResults,
    ...languageResults,
    ...otherResults
  ];

  const score = calculateWeightedScore(allResults);

  const breakdown: ScoringBreakdown = {
    jobType: calculateOriginalScaleContribution(jobTypeResults),
    technologies: calculateOriginalScaleContribution(technologyResults),
    experience: calculateOriginalScaleContribution(experienceResults),
    location: calculateOriginalScaleContribution(locationResults),
    employmentConditions: calculateOriginalScaleContribution(employmentResults),
    languages: calculateOriginalScaleContribution(languageResults),
    otherRequirements: calculateOriginalScaleContribution(otherResults)
  };

  return {
    score,
    category: classifyScore(score),
    breakdown
  };
}

export function classifyScore(
  score: number | null
): ScoringCategory | null {
  if (score === null) {
    return null;
  }

  if (score >= 80) {
    return "HIGH_MATCH";
  }

  if (score >= 65) {
    return "GOOD_MATCH";
  }

  if (score >= 50) {
    return "POSSIBLE_MATCH";
  }

  return "LOW_MATCH";
}
