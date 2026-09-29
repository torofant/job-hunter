import {
  index,
  pgEnum,
  pgTable,
  real,
  text,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const jobFamily = pgEnum("job_family", [
  "WEB",
  "SOFTWARE",
  "AUTOMATION",
  "SYSTEMS",
  "SUPPORT",
  "OTHER",
  "UNKNOWN"
]);

export const jobRole = pgEnum("job_role", [
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

export const modality = pgEnum("modality", [
  "REMOTE",
  "HYBRID",
  "ONSITE",
  "UNKNOWN"
]);

export const contractType = pgEnum("contract_type", [
  "PERMANENT",
  "TEMPORARY",
  "UNKNOWN"
]);

export const employmentType = pgEnum("employment_type", [
  "EMPLOYEE",
  "FREELANCE",
  "SELF_EMPLOYED",
  "INTERNSHIP",
  "SCHOLARSHIP",
  "TRAINEE",
  "UNKNOWN"
]);

export const workingHours = pgEnum("working_hours", [
  "FULL_TIME",
  "PART_TIME",
  "UNKNOWN"
]);

export const jobOffers = pgTable(
  "job_offers",
  {
    id: uuid("id").primaryKey(),

    // Datos necesarios para deduplicación.
    source: text("source").notNull(),
    sourceJobId: text("source_job_id"),
    normalizedUrl: text("normalized_url"),

    title: text("title").notNull(),
    company: text("company"),

    jobFamily: jobFamily("job_family").notNull(),
    role: jobRole("role").notNull(),

    country: text("country"),
    city: text("city"),
    modality: modality("modality").notNull(),
    distanceKm: real("distance_km"),

    contract: contractType("contract").notNull(),
    employmentType: employmentType("employment_type").notNull(),
    workingHours: workingHours("working_hours").notNull()
  },
  (table) => [
    uniqueIndex("job_offers_source_source_job_id_uq").on(
      table.source,
      table.sourceJobId
    ),
    uniqueIndex("job_offers_normalized_url_uq").on(
      table.normalizedUrl
    ),
    index("job_offers_source_idx").on(table.source)
  ]
);