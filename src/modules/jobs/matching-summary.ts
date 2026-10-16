import { z } from "zod";
import type { Requirement } from "./requirement.js";
import type { RequirementMatch } from "./requirement-match.js";

type MatchingResult = RequirementMatch["result"];

type MatchingSummaryInput = {
  requirement: Requirement;
  match: RequirementMatch;
};

const matchingGroupSchema = z.object({
  total: z.number().int().nonnegative(),
  evaluated: z.number().int().nonnegative(),
  match: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
  notApplicable: z.number().int().nonnegative(),
  compliance: z.number().min(0).max(1).nullable()
});

export const matchingSummarySchema = z.object({
  required: matchingGroupSchema.extend({
    hasMissing: z.boolean()
  }),

  preferred: matchingGroupSchema
});

export type MatchingSummary = z.infer<typeof matchingSummarySchema>;

function createEmptyGroup() {
  return {
    total: 0,
    evaluated: 0,
    match: 0,
    partial: 0,
    missing: 0,
    unknown: 0,
    notApplicable: 0,
    compliance: null as number | null
  };
}

export function buildMatchingSummary(
  results: MatchingSummaryInput[]
): MatchingSummary {
  const required = createEmptyGroup();
  const preferred = createEmptyGroup();

  for (const { requirement, match } of results) {
    const group =
      requirement.importance === "required"
        ? required
        : preferred;

    group.total += 1;

    switch (match.result as MatchingResult) {
      case "MATCH":
        group.match += 1;
        break;

      case "PARTIAL":
        group.partial += 1;
        break;

      case "MISSING":
        group.missing += 1;
        break;

      case "UNKNOWN":
        group.unknown += 1;
        break;

      case "N/A":
        group.notApplicable += 1;
        break;
    }
  }

  for (const group of [required, preferred]) {
    group.evaluated =
      group.match + group.partial + group.missing;

    group.compliance =
      group.evaluated === 0
        ? null
        : (
            group.match + group.partial * 0.7
          ) / group.evaluated;
  }

  return matchingSummarySchema.parse({
    required: {
      ...required,
      hasMissing: required.missing > 0
    },
    preferred
  });
}