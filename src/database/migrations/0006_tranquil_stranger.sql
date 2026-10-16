CREATE TYPE "public"."requirement_category" AS ENUM('TECHNOLOGY', 'EXPERIENCE', 'LANGUAGE');--> statement-breakpoint
CREATE TYPE "public"."requirement_importance" AS ENUM('REQUIRED', 'PREFERRED');--> statement-breakpoint
CREATE TYPE "public"."requirement_type" AS ENUM('SINGLE', 'ALTERNATIVE', 'GROUP');--> statement-breakpoint
CREATE TABLE "requirements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_offer_id" uuid NOT NULL,
	"category" "requirement_category" NOT NULL,
	"type" "requirement_type" NOT NULL,
	"importance" "requirement_importance" NOT NULL,
	"data" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_job_offer_id_job_offers_id_fk" FOREIGN KEY ("job_offer_id") REFERENCES "public"."job_offers"("id") ON DELETE no action ON UPDATE no action;