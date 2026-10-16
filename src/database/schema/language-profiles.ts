import { pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { userProfiles } from "./user-profiles.js";

export const languageLevel = pgEnum("language_level", [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2"
]);

export const languageProfiles = pgTable("language_profiles", {
  id: uuid("id").primaryKey(),

  userProfileId: uuid("user_profile_id")
    .notNull()
    .references(() => userProfiles.id),

  language: text("language").notNull(),
  level: languageLevel("level").notNull()
});