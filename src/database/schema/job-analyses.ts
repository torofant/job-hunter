import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { jobOffers } from "./job-offers.js";
import { processingRuns } from "./processing-runs.js";

export const requirementExtractionStatus = pgEnum(
  "requirement_extraction_status",
  ["PENDING", "COMPLETED", "FAILED"]
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

  requirementExtractionStatus: requirementExtractionStatus(
    "requirement_extraction_status"
  ).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});