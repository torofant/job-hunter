import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  uuid
} from "drizzle-orm/pg-core";

import { jobOffers } from "./job-offers.js";

export const requirementCategory = pgEnum("requirement_category", [
  "TECHNOLOGY",
  "EXPERIENCE",
  "LANGUAGE",
  "OTHER"
]);

export const requirementType = pgEnum("requirement_type", [
  "SINGLE",
  "ALTERNATIVE",
  "GROUP"
]);

export const requirementImportance = pgEnum("requirement_importance", [
  "REQUIRED",
  "PREFERRED"
]);

export const requirements = pgTable("requirements", {
  id: uuid("id").primaryKey(),

  jobOfferId: uuid("job_offer_id")
    .notNull()
    .references(() => jobOffers.id),

  category: requirementCategory("category").notNull(),
  type: requirementType("type").notNull(),
  importance: requirementImportance("importance").notNull(),

  data: jsonb("data").notNull(),

  active: boolean("active").notNull().default(true)
});