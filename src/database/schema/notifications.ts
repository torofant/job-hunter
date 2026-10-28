import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import { jobAnalyses } from "./job-analyses.js";
import { jobOffers } from "./job-offers.js";

export const notificationStatus = pgEnum("notification_status", [
  "PENDING",
  "SENDING",
  "SENT",
  "FAILED",
  "UNKNOWN"
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey(),

    jobOfferId: uuid("job_offer_id")
      .notNull()
      .references(() => jobOffers.id),

    jobAnalysisId: uuid("job_analysis_id")
      .notNull()
      .references(() => jobAnalyses.id),

    status: notificationStatus("status")
      .notNull()
      .default("PENDING"),

    message: text("message").notNull(),

    detectedAt: timestamp("detected_at", {
      withTimezone: true
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true
    }).notNull(),

    sentAt: timestamp("sent_at", {
      withTimezone: true
    }),

    lastError: text("last_error")
  },
  (table) => [
    uniqueIndex("notifications_job_offer_id_uq").on(
      table.jobOfferId
    ),
    index("notifications_status_created_at_idx").on(
      table.status,
      table.createdAt
    )
  ]
);
