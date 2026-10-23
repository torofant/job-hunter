import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { jobOffers } from "./job-offers.js";
import { processingRuns } from "./processing-runs.js";

export const requirementExtractionStatus = pgEnum(
  "requirement_extraction_status",
  ["PENDING", "COMPLETED", "FAILED"]
);

export const confidenceLevel = pgEnum(
  "confidence_level",
  ["HIGH", "MEDIUM", "LOW"]
);

export const jobAnalyses = pgTable("job_analyses", {
  id: uuid("id").primaryKey(),

  jobOfferId: uuid("job_offer_id")
    .notNull()
    .references(() => jobOffers.id),

  processingRunId: uuid("processing_run_id")
    .notNull()
    .references(() => processingRuns.id),

  version: integer("version").notNull(),

  matchingSummary: jsonb("matching_summary"),

  score: real("score"),

  coverage: real("coverage"),

  coverageBreakdown: jsonb("coverage_breakdown").$type<
    Record<string, number | null>
  >(),

  confidenceLevel: confidenceLevel("confidence_level"),

  requirementExtractionStatus: requirementExtractionStatus(
    "requirement_extraction_status"
  ).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});