CREATE TYPE "public"."processing_run_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TABLE "job_detections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"raw_input_id" uuid NOT NULL,
	"processing_run_id" uuid NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	CONSTRAINT "job_detections_raw_input_id_unique" UNIQUE("raw_input_id")
);
--> statement-breakpoint
CREATE TABLE "processing_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" "processing_run_status" DEFAULT 'PENDING' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"attempt" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "raw_job_inputs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_job_id" text,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"location" text,
	"detected_at" timestamp with time zone NOT NULL,
	"raw_metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "job_detections" ADD CONSTRAINT "job_detections_raw_input_id_raw_job_inputs_id_fk" FOREIGN KEY ("raw_input_id") REFERENCES "public"."raw_job_inputs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_detections" ADD CONSTRAINT "job_detections_processing_run_id_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."processing_runs"("id") ON DELETE no action ON UPDATE no action;