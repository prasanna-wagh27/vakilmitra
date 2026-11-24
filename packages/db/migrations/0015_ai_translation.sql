CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"advocate_id" text,
	"task" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_translation" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"lang" "locale" NOT NULL,
	"source_hash" text NOT NULL,
	"text" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocate" ADD COLUMN "ai_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "advocate" ADD COLUMN "ai_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_owner_id_advocate_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."advocate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_advocate_id_advocate_id_fk" FOREIGN KEY ("advocate_id") REFERENCES "public"."advocate"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_translation" ADD CONSTRAINT "page_translation_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_owner_at_idx" ON "ai_usage" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "page_translation_page_lang_uq" ON "page_translation" USING btree ("page_id","lang");