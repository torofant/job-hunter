import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { processingRuns } from "./processing-runs.js";
import { rawJobInputs } from "./raw-job-inputs.js";

export const jobDetections = pgTable("job_detections", {
  id: uuid("id").primaryKey(),
  rawInputId: uuid("raw_input_id")
    .notNull()
    .unique()
    .references(() => rawJobInputs.id),
  processingRunId: uuid("processing_run_id")
    .notNull()
    .references(() => processingRuns.id),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull()
});
