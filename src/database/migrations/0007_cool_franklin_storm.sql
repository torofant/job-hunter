CREATE TYPE "public"."requirement_extraction_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."requirement_match_result" AS ENUM('MATCH', 'PARTIAL', 'MISSING', 'UNKNOWN', 'N_A');--> statement-breakpoint
CREATE TABLE "job_analyses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_offer_id" uuid NOT NULL,
	"processing_run_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"matching_summary" jsonb,
	"requirement_extraction_status" "requirement_extraction_status" NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_analysis_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"result" "requirement_match_result" NOT NULL,
	"evidence" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_job_offer_id_job_offers_id_fk" FOREIGN KEY ("job_offer_id") REFERENCES "public"."job_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_processing_run_id_processing_runs_id_fk" FOREIGN KEY ("processing_run_id") REFERENCES "public"."processing_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_matches" ADD CONSTRAINT "requirement_matches_job_analysis_id_job_analyses_id_fk" FOREIGN KEY ("job_analysis_id") REFERENCES "public"."job_analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_matches" ADD CONSTRAINT "requirement_matches_requirement_id_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."requirements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "requirement_matches_analysis_requirement_uq" ON "requirement_matches" USING btree ("job_analysis_id","requirement_id");