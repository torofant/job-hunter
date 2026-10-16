import { z } from "zod";

export const requirementMatchResultSchema = z.enum([
  "MATCH",
  "PARTIAL",
  "MISSING",
  "UNKNOWN",
  "N/A"
]);

export const evidenceSchema = z.record(z.string(), z.unknown());

export const requirementMatchSchema = z.object({
  requirementId: z.string().uuid(),
  result: requirementMatchResultSchema,
  evidence: evidenceSchema
});

export type RequirementMatch = z.infer<typeof requirementMatchSchema>;