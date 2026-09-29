import { pgEnum, pgTable, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

import { jobOffers } from "./job-offers.js";
import { processingRuns } from "./processing-runs.js";
import { rawJobInputs } from "./raw-job-inputs.js";

export const filterStatus = pgEnum("filter_status", [
  "ACCEPTED",
  "REJECTED"
]);

export const jobDetections = pgTable("job_detections", {
  id: uuid("id").primaryKey(),
  rawInputId: uuid("raw_input_id")
    .notNull()
    .unique()
    .references(() => rawJobInputs.id),
  processingRunId: uuid("processing_run_id")
    .notNull()
    .references(() => processingRuns.id),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
  jobOfferId: uuid("job_offer_id").references(() => jobOffers.id),
  filterStatus: filterStatus("filter_status"),
  filterReasons: jsonb("filter_reasons")
});