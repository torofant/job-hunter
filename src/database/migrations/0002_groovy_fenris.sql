CREATE TYPE "public"."contract_type" AS ENUM('PERMANENT', 'TEMPORARY', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('EMPLOYEE', 'FREELANCE', 'SELF_EMPLOYED', 'INTERNSHIP', 'SCHOLARSHIP', 'TRAINEE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."job_family" AS ENUM('WEB', 'SOFTWARE', 'AUTOMATION', 'SYSTEMS', 'SUPPORT', 'OTHER', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."job_role" AS ENUM('FULL_STACK_DEVELOPER', 'FRONTEND_DEVELOPER', 'BACKEND_DEVELOPER', 'WEB_DEVELOPER', 'SOFTWARE_DEVELOPER', 'AUTOMATION_DEVELOPER', 'INTEGRATION_DEVELOPER', 'PROCESS_AUTOMATION_DEVELOPER', 'SYSTEM_ADMINISTRATOR', 'DEVOPS', 'INFRASTRUCTURE_ENGINEER', 'APPLICATION_SUPPORT', 'TECHNICAL_SUPPORT', 'TECHNICAL_CONSULTANT', 'HARDWARE_TECHNICIAN', 'OTHER', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."working_hours" AS ENUM('FULL_TIME', 'PART_TIME', 'UNKNOWN');--> statement-breakpoint
CREATE TABLE "job_offers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_job_id" text,
	"normalized_url" text,
	"title" text NOT NULL,
	"company" text,
	"job_family" "job_family" NOT NULL,
	"role" "job_role" NOT NULL,
	"country" text,
	"city" text,
	"modality" "modality" NOT NULL,
	"distance_km" real,
	"contract" "contract_type" NOT NULL,
	"employment_type" "employment_type" NOT NULL,
	"working_hours" "working_hours" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_detections" ADD COLUMN "job_offer_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "job_offers_source_source_job_id_uq" ON "job_offers" USING btree ("source","source_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_offers_normalized_url_uq" ON "job_offers" USING btree ("normalized_url");--> statement-breakpoint
CREATE INDEX "job_offers_source_idx" ON "job_offers" USING btree ("source");--> statement-breakpoint
ALTER TABLE "job_detections" ADD CONSTRAINT "job_detections_job_offer_id_job_offers_id_fk" FOREIGN KEY ("job_offer_id") REFERENCES "public"."job_offers"("id") ON DELETE no action ON UPDATE no action;