CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"detection_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"estimated_cost" numeric(10, 6),
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_detection_id_job_detections_id_fk" FOREIGN KEY ("detection_id") REFERENCES "public"."job_detections"("id") ON DELETE no action ON UPDATE no action;