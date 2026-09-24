import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const rawJobInputs = pgTable("raw_job_inputs", {
  id: uuid("id").primaryKey(),
  source: text("source").notNull(),
  sourceJobId: text("source_job_id"),
  title: text("title").notNull(),
  company: text("company").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  location: text("location"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
  rawMetadata: jsonb("raw_metadata")
});
