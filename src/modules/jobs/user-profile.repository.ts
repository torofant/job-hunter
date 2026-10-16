import type { Database } from "../../database/client.js";
import {
  experiences,
  languageProfiles,
  targetRoles,
  technologyProfiles,
  userProfiles
} from "../../database/schema/index.js";
import {
  userProfileSchema,
  type UserProfile
} from "./user-profile.js";
import { eq } from "drizzle-orm";

export class UserProfileRepository {
  constructor(private readonly db: Database) { }

  async getProfile(): Promise<UserProfile> {
    const profileRows = await this.db
      .select()
      .from(userProfiles)
      .limit(1);

    const profile = profileRows[0];

    if (!profile) {
      throw new Error("User profile not found");
    }

    const [targetRoleRows, technologyRows, experienceRows, languageRows] =
      await Promise.all([
        this.db
          .select()
          .from(targetRoles)
          .where(eq(targetRoles.userProfileId, profile.id)),

        this.db
          .select()
          .from(technologyProfiles)
          .where(eq(technologyProfiles.userProfileId, profile.id)),

        this.db
          .select()
          .from(experiences)
          .where(eq(experiences.userProfileId, profile.id)),

        this.db
          .select()
          .from(languageProfiles)
          .where(eq(languageProfiles.userProfileId, profile.id))
      ]);

    return userProfileSchema.parse({
      id: profile.id,

      targetRoles: targetRoleRows.map((row) => ({
        family: row.family,
        role: row.role,
        priorityOrder: row.priorityOrder
      })),

      technologies: technologyRows.map((row) => ({
        name: row.name,
        level: row.level,
        context: row.context
      })),

      experiences: experienceRows.map((row) => ({
        role: row.role,
        area: row.area,
        context: row.context,
        start: row.start,
        end: row.end,
        technologies: Array.isArray(row.technologies)
          ? row.technologies.filter(
              (technology): technology is string =>
                typeof technology === "string"
            )
          : [],
        responsibilities: Array.isArray(row.responsibilities)
          ? row.responsibilities.filter(
              (responsibility): responsibility is string =>
                typeof responsibility === "string"
            )
          : [],
        description: row.description,
        contextType: row.contextType
      })),

      languages: languageRows.map((row) => ({
        language: row.language,
        level: row.level
      })),

      locationPreferences: profile.locationPreferences,
      employmentPreferences: profile.employmentPreferences,
      salaryPreferences: profile.salaryPreferences
    });
  }
}