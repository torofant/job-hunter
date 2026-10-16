import { jsonb, pgTable, uuid } from "drizzle-orm/pg-core";

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey(),

  locationPreferences: jsonb("location_preferences"),
  employmentPreferences: jsonb("employment_preferences"),
  salaryPreferences: jsonb("salary_preferences")
});