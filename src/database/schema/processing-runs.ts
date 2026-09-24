import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const processingRunStatus = pgEnum("processing_run_status", [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED"
]);

export const processingRuns = pgTable(
  "processing_runs",
  {
    id: uuid("id").primaryKey(),
    status: processingRunStatus("status").notNull().default("PENDING"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    attempt: integer("attempt").notNull().default(0),
    lastError: text("last_error")
  },
  (table) => [index("processing_runs_status_started_at_idx").on(table.status, table.startedAt)]
);
