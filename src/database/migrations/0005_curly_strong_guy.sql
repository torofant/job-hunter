CREATE TYPE "public"."experience_context_type" AS ENUM('PROFESSIONAL', 'ACADEMIC', 'PERSONAL');--> statement-breakpoint
CREATE TYPE "public"."language_level" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"location_preferences" jsonb,
	"employment_preferences" jsonb,
	"salary_preferences" jsonb
);
--> statement-breakpoint
CREATE TABLE "target_roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"family" "job_family" NOT NULL,
	"role" "job_role" NOT NULL,
	"priority_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technology_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"level" text,
	"context" text
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"role" "job_role" NOT NULL,
	"area" text,
	"context" text,
	"start" date NOT NULL,
	"end" date,
	"technologies" jsonb,
	"responsibilities" jsonb,
	"description" text,
	"context_type" "experience_context_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "language_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_profile_id" uuid NOT NULL,
	"language" text NOT NULL,
	"level" "language_level" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "target_roles" ADD CONSTRAINT "target_roles_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_profiles" ADD CONSTRAINT "technology_profiles_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "language_profiles" ADD CONSTRAINT "language_profiles_user_profile_id_user_profiles_id_fk" FOREIGN KEY ("user_profile_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;