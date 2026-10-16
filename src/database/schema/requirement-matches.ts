import {
  jsonb,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { jobAnalyses } from "./job-analyses.js";
import { requirements } from "./requirements.js";

export const requirementMatchResult = pgEnum("requirement_match_result", [
  "MATCH",
  "PARTIAL",
  "MISSING",
  "UNKNOWN",
  "N_A"
]);

export const requirementMatches = pgTable(
  "requirement_matches",
  {
    id: uuid("id").primaryKey(),

    jobAnalysisId: uuid("job_analysis_id")
      .notNull()
      .references(() => jobAnalyses.id),

    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => requirements.id),

    result: requirementMatchResult("result").notNull(),

    evidence: jsonb("evidence").notNull()
  },
  (table) => [
    uniqueIndex("requirement_matches_analysis_requirement_uq").on(
      table.jobAnalysisId,
      table.requirementId
    )
  ]
);