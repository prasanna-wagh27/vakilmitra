CREATE TYPE "public"."case_kind" AS ENUM('CIVIL', 'LAND_PROPERTY', 'TITLE_SEARCH', 'CRIMINAL', 'FAMILY', 'REVENUE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."case_role" AS ENUM('EDITOR', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('ACTIVE', 'DISPOSED', 'ON_HOLD', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('SEVEN_TWELVE', 'FERFAR', 'EIGHT_A', 'INDEX_II', 'SALE_DEED', 'GIFT_DEED', 'WILL', 'PARTITION_DEED', 'MORTGAGE_DEED', 'COURT_ORDER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('DRAFT', 'APPROVED');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('RECORD_SNAPSHOT', 'DEED', 'MUTATION');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('mr', 'en');--> statement-breakpoint
CREATE TYPE "public"."ocr_status" AS ENUM('PENDING', 'PROCESSING', 'DONE', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."party_role" AS ENUM('PETITIONER', 'RESPONDENT', 'PLAINTIFF', 'DEFENDANT', 'APPLICANT', 'OPPONENT', 'APPELLANT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."flag_severity" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TABLE "access_log" (
	"id" text PRIMARY KEY NOT NULL,
	"advocate_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advocate" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"phone" text,
	"bar_council_no" text,
	"locale" "locale" DEFAULT 'mr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advocate_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "case_access" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"advocate_id" text NOT NULL,
	"role" "case_role" DEFAULT 'VIEWER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_file" (
	"id" text PRIMARY KEY NOT NULL,
	"advocate_id" text NOT NULL,
	"client_id" text,
	"title" text NOT NULL,
	"kind" "case_kind" DEFAULT 'CIVIL' NOT NULL,
	"case_number" text,
	"court" text,
	"cnr_number" text,
	"status" "case_status" DEFAULT 'ACTIVE' NOT NULL,
	"filed_on" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" text PRIMARY KEY NOT NULL,
	"advocate_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"property_id" text,
	"type" "doc_type" DEFAULT 'OTHER' NOT NULL,
	"year" integer,
	"title" text,
	"storage_key" text,
	"mime_type" text,
	"ocr_status" "ocr_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draft" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"template" text NOT NULL,
	"language" "locale" DEFAULT 'mr' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "draft_status" DEFAULT 'DRAFT' NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fact" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"document_id" text,
	"page_id" text,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"crop_x" real,
	"crop_y" real,
	"crop_w" real,
	"crop_h" real,
	"reviewed" boolean DEFAULT false NOT NULL,
	"reviewed_by_id" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fee_agreement" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text,
	"client_id" text NOT NULL,
	"description" text NOT NULL,
	"total_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flag" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"property_id" text,
	"rule" text NOT NULL,
	"severity" "flag_severity" NOT NULL,
	"message" text NOT NULL,
	"event_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"fact_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hearing" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"court" text,
	"purpose" text,
	"next_step" text,
	"outcome" text,
	"reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installment" (
	"id" text PRIMARY KEY NOT NULL,
	"agreement_id" text NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"amount_paise" integer NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "ownership_event" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text NOT NULL,
	"kind" "event_kind" NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"subtype" text,
	"ferfar_no" text,
	"deed_reg_no" text,
	"ref_deed_reg_no" text,
	"from_parties" text[] DEFAULT '{}'::text[] NOT NULL,
	"to_parties" text[] DEFAULT '{}'::text[] NOT NULL,
	"owners" text[] DEFAULT '{}'::text[] NOT NULL,
	"area_sqm" double precision,
	"land_class" text,
	"other_rights" text[] DEFAULT '{}'::text[] NOT NULL,
	"section_155" boolean DEFAULT false NOT NULL,
	"fact_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"page_no" integer NOT NULL,
	"storage_key" text,
	"ocr_text" text,
	"width" integer,
	"height" integer
);
--> statement-breakpoint
CREATE TABLE "party" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"name" text NOT NULL,
	"role" "party_role" NOT NULL,
	"is_our_client" boolean DEFAULT false NOT NULL,
	"opposing_counsel" text,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"agreement_id" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"paid_on" timestamp with time zone NOT NULL,
	"mode" text,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"survey_no" text,
	"gat_no" text,
	"hissa_no" text,
	"village" text,
	"taluka" text,
	"district" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_advocate_id_advocate_id_fk" FOREIGN KEY ("advocate_id") REFERENCES "public"."advocate"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_advocate_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."advocate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_access" ADD CONSTRAINT "case_access_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_access" ADD CONSTRAINT "case_access_advocate_id_advocate_id_fk" FOREIGN KEY ("advocate_id") REFERENCES "public"."advocate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_file" ADD CONSTRAINT "case_file_advocate_id_advocate_id_fk" FOREIGN KEY ("advocate_id") REFERENCES "public"."advocate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_file" ADD CONSTRAINT "case_file_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_advocate_id_advocate_id_fk" FOREIGN KEY ("advocate_id") REFERENCES "public"."advocate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact" ADD CONSTRAINT "fact_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_agreement" ADD CONSTRAINT "fee_agreement_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_agreement" ADD CONSTRAINT "fee_agreement_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag" ADD CONSTRAINT "flag_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flag" ADD CONSTRAINT "flag_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearing" ADD CONSTRAINT "hearing_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment" ADD CONSTRAINT "installment_agreement_id_fee_agreement_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."fee_agreement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_event" ADD CONSTRAINT "ownership_event_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party" ADD CONSTRAINT "party_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_agreement_id_fee_agreement_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."fee_agreement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_advocate_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."advocate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_log_advocate_at_idx" ON "access_log" USING btree ("advocate_id","at");--> statement-breakpoint
CREATE INDEX "access_log_entity_idx" ON "access_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "case_access_case_advocate_uq" ON "case_access" USING btree ("case_id","advocate_id");--> statement-breakpoint
CREATE INDEX "case_access_advocate_idx" ON "case_access" USING btree ("advocate_id");--> statement-breakpoint
CREATE INDEX "case_advocate_status_idx" ON "case_file" USING btree ("advocate_id","status");--> statement-breakpoint
CREATE INDEX "case_client_idx" ON "case_file" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_advocate_idx" ON "client" USING btree ("advocate_id");--> statement-breakpoint
CREATE INDEX "document_case_idx" ON "document" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "draft_case_idx" ON "draft" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "fact_case_field_idx" ON "fact" USING btree ("case_id","field");--> statement-breakpoint
CREATE INDEX "fee_agreement_client_idx" ON "fee_agreement" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "flag_case_idx" ON "flag" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "flag_property_idx" ON "flag" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "hearing_case_date_idx" ON "hearing" USING btree ("case_id","date");--> statement-breakpoint
CREATE INDEX "hearing_date_idx" ON "hearing" USING btree ("date");--> statement-breakpoint
CREATE INDEX "event_property_date_idx" ON "ownership_event" USING btree ("property_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "page_document_no_uq" ON "page" USING btree ("document_id","page_no");--> statement-breakpoint
CREATE INDEX "party_case_idx" ON "party" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "property_case_idx" ON "property" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");