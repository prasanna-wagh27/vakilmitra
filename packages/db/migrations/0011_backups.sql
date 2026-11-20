CREATE TABLE "backup_run" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'RUNNING' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"dump_bytes" bigint,
	"rows" integer,
	"files" integer,
	"files_copied" integer,
	"error" text,
	"checked_at" timestamp with time zone,
	"check_ok" boolean,
	"check_error" text
);
--> statement-breakpoint
CREATE INDEX "backup_run_started_idx" ON "backup_run" USING btree ("started_at");