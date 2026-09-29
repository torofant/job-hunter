CREATE TYPE "public"."filter_status" AS ENUM('ACCEPTED', 'REJECTED');--> statement-breakpoint
ALTER TABLE "job_detections" ADD COLUMN "filter_status" "filter_status";--> statement-breakpoint
ALTER TABLE "job_detections" ADD COLUMN "filter_reasons" jsonb;