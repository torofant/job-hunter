import { pgTable, text, uuid } from "drizzle-orm/pg-core";

import { userProfiles } from "./user-profiles.js";

export const technologyProfiles = pgTable("technology_profiles", {
  id: uuid("id").primaryKey(),

  userProfileId: uuid("user_profile_id")
    .notNull()
    .references(() => userProfiles.id),

  name: text("name").notNull(),
  level: text("level"),
  context: text("context")
});