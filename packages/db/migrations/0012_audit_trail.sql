ALTER TABLE "access_log" ALTER COLUMN "entity_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "access_log" ALTER COLUMN "entity_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "actor" text DEFAULT 'advocate' NOT NULL;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "case_id" text;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "route" text;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "status" integer;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "details" jsonb;--> statement-breakpoint
ALTER TABLE "access_log" ADD COLUMN "user_agent" text;--> statement-breakpoint
CREATE INDEX "access_log_case_at_idx" ON "access_log" USING btree ("case_id","at");--> statement-breakpoint
UPDATE "access_log" SET "case_id" = "entity_id" WHERE "entity_type" = 'case';