import { integer, pgTable, uuid } from "drizzle-orm/pg-core";

import { jobFamily, jobRole } from "./job-offers.js";
import { userProfiles } from "./user-profiles.js";

export const targetRoles = pgTable("target_roles", {
  id: uuid("id").primaryKey(),

  userProfileId: uuid("user_profile_id")
    .notNull()
    .references(() => userProfiles.id),

  family: jobFamily("family").notNull(),
  role: jobRole("role").notNull(),
  priorityOrder: integer("priority_order").notNull()
});