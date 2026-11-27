CREATE TABLE "case_tracking" (
	"case_id" text PRIMARY KEY NOT NULL,
	"cnr" text NOT NULL,
	"enabled_by_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"error" text,
	"failures" integer DEFAULT 0 NOT NULL,
	"provider" text,
	"snapshot" jsonb,
	"last_checked_at" timestamp with time zone,
	"last_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "court_update" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"kind" text NOT NULL,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocate" ADD COLUMN "daily_digest" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "hearing" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "case_tracking" ADD CONSTRAINT "case_tracking_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_tracking" ADD CONSTRAINT "case_tracking_enabled_by_id_advocate_id_fk" FOREIGN KEY ("enabled_by_id") REFERENCES "public"."advocate"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_update" ADD CONSTRAINT "court_update_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_tracking_cnr_idx" ON "case_tracking" USING btree ("cnr");--> statement-breakpoint
CREATE INDEX "court_update_case_at_idx" ON "court_update" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "court_update_at_idx" ON "court_update" USING btree ("created_at");