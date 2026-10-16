import {
  date,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid
} from "drizzle-orm/pg-core";

import { jobRole } from "./job-offers.js";
import { userProfiles } from "./user-profiles.js";

export const experienceContextType = pgEnum("experience_context_type", [
  "PROFESSIONAL",
  "ACADEMIC",
  "PERSONAL"
]);

export const experiences = pgTable("experiences", {
  id: uuid("id").primaryKey(),

  userProfileId: uuid("user_profile_id")
    .notNull()
    .references(() => userProfiles.id),

  role: jobRole("role").notNull(),
  area: text("area"),
  context: text("context"),

  start: date("start", { mode: "string" }).notNull(),
  end: date("end", { mode: "string" }),

  technologies: jsonb("technologies"),
  responsibilities: jsonb("responsibilities"),
  description: text("description"),

  contextType: experienceContextType("context_type").notNull()
});