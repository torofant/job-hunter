import {
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

import { jobDetections } from "./job-detections.js";

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),

  requestHash: text("request_hash").notNull(),

  detectionId: uuid("detection_id")
    .notNull()
    .references(() => jobDetections.id),

  createdAt: timestamp("created_at", {
    withTimezone: true
  }).notNull()
});
