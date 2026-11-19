CREATE TYPE "public"."staff_role" AS ENUM('OWNER', 'SUPPORT');--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "staff_role" DEFAULT 'SUPPORT' NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret" text NOT NULL,
	"totp_last_step" integer,
	"disabled" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "staff_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" jsonb,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_session" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_session_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "staff_audit" ADD CONSTRAINT "staff_audit_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_session" ADD CONSTRAINT "staff_session_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_audit_at_idx" ON "staff_audit" USING btree ("at");--> statement-breakpoint
CREATE INDEX "staff_audit_target_idx" ON "staff_audit" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "staff_session_staff_idx" ON "staff_session" USING btree ("staff_id");--> statement-breakpoint
-- Accounts created before billing existed start their 14-day trial now.
INSERT INTO "subscription" ("advocate_id", "trial_ends_at") SELECT "id", now() + interval '14 days' FROM "advocate" ON CONFLICT DO NOTHING;
