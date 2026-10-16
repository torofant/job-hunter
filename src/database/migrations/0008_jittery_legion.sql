CREATE TYPE "public"."ai_usage_purpose" AS ENUM('ENRICHMENT', 'REQUIREMENT_EXTRACTION');--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "purpose" "ai_usage_purpose" DEFAULT 'ENRICHMENT' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "prompt_version" varchar(50);