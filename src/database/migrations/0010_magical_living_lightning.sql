CREATE TYPE "public"."confidence_level" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
ALTER TABLE "job_analyses" ADD COLUMN "score" real;--> statement-breakpoint
ALTER TABLE "job_analyses" ADD COLUMN "coverage" real;--> statement-breakpoint
ALTER TABLE "job_analyses" ADD COLUMN "coverage_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "job_analyses" ADD COLUMN "confidence_level" "confidence_level";