import {
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
  integer,
  numeric
} from "drizzle-orm/pg-core";

import { jobDetections } from "./job-detections.js";

export const aiUsagePurpose = pgEnum("ai_usage_purpose", [
  "ENRICHMENT",
  "REQUIREMENT_EXTRACTION"
]);

export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").primaryKey(),

  detectionId: uuid("detection_id")
    .notNull()
    .references(() => jobDetections.id),

  provider: varchar("provider", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),

  purpose: aiUsagePurpose("purpose")
    .notNull()
    .default("ENRICHMENT"),

  promptVersion: varchar("prompt_version", { length: 50 }),

  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),

  estimatedCost: numeric("estimated_cost", {
    precision: 10,
    scale: 6
  }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});