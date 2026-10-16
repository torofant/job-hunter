import { z } from "zod";

const jobFamilySchema = z.enum([
  "WEB",
  "SOFTWARE",
  "AUTOMATION",
  "SYSTEMS",
  "SUPPORT",
  "OTHER",
  "UNKNOWN"
]);

const jobRoleSchema = z.enum([
  "FULL_STACK_DEVELOPER",
  "FRONTEND_DEVELOPER",
  "BACKEND_DEVELOPER",
  "WEB_DEVELOPER",
  "SOFTWARE_DEVELOPER",
  "AUTOMATION_DEVELOPER",
  "INTEGRATION_DEVELOPER",
  "PROCESS_AUTOMATION_DEVELOPER",
  "SYSTEM_ADMINISTRATOR",
  "DEVOPS",
  "INFRASTRUCTURE_ENGINEER",
  "APPLICATION_SUPPORT",
  "TECHNICAL_SUPPORT",
  "TECHNICAL_CONSULTANT",
  "HARDWARE_TECHNICIAN",
  "OTHER",
  "UNKNOWN"
]);

const targetRoleSchema = z.object({
  family: jobFamilySchema,
  role: jobRoleSchema,
  priorityOrder: z.number().int().nonnegative()
});

const technologyProfileSchema = z.object({
  name: z.string().min(1),
  level: z.string().nullable(),
  context: z.string().nullable()
});

const experienceSchema = z.object({
  role: jobRoleSchema,
  area: z.string().nullable(),
  context: z.string().nullable(),
  start: z.string(),
  end: z.string().nullable(),
  technologies: z.array(z.string()),
  responsibilities: z.array(z.string()),
  description: z.string().nullable(),
  contextType: z.enum([
    "PROFESSIONAL",
    "ACADEMIC",
    "PERSONAL"
  ])
});

const languageProfileSchema = z.object({
  language: z.string().min(1),
  level: z.enum([
    "A1",
    "A2",
    "B1",
    "B2",
    "C1",
    "C2"
  ])
});

const locationPreferencesSchema = z.object({
  remoteAllowed: z.boolean(),
  hybridAllowed: z.boolean(),
  onsiteAllowed: z.boolean(),
  hybridMaxCity: z.string().nullable(),
  onsiteMaxDistanceKm: z.number().nonnegative().nullable(),
  relocationAllowed: z.boolean()
});

const employmentPreferencesSchema = z.object({
  fullTimeAllowed: z.boolean(),
  partTimeAllowed: z.boolean(),
  permanentAllowed: z.boolean(),
  temporaryAllowed: z.boolean(),
  internshipAllowed: z.boolean(),
  scholarshipAllowed: z.boolean(),
  traineeAllowed: z.boolean(),
  freelanceAllowed: z.boolean(),
  selfEmployedAllowed: z.boolean()
});

const salaryPreferencesSchema = z.object({
  currency: z.string().min(1),
  minimum: z.number().nonnegative(),
  desired: z.number().nonnegative()
});

export const userProfileSchema = z.object({
  id: z.string().uuid(),

  targetRoles: z.array(targetRoleSchema),
  technologies: z.array(technologyProfileSchema),
  experiences: z.array(experienceSchema),
  languages: z.array(languageProfileSchema),

  locationPreferences: locationPreferencesSchema,
  employmentPreferences: employmentPreferencesSchema,
  salaryPreferences: salaryPreferencesSchema
});

export type UserProfile = z.infer<typeof userProfileSchema>;
export type TargetRole = z.infer<typeof targetRoleSchema>;
export type TechnologyProfile = z.infer<typeof technologyProfileSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type LanguageProfile = z.infer<typeof languageProfileSchema>;