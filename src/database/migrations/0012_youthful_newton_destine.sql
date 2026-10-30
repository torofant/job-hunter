CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"request_hash" text NOT NULL,
	"detection_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_detection_id_job_detections_id_fk" FOREIGN KEY ("detection_id") REFERENCES "public"."job_detections"("id") ON DELETE no action ON UPDATE no action;