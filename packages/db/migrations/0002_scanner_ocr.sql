ALTER TABLE "page" ALTER COLUMN "storage_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "source" text DEFAULT 'scan' NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "byte_size" integer;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "ocr_status" "ocr_status" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "ocr_engine" text;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "ocr_confidence" real;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "ocr_words" jsonb;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "ocr_error" text;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "ocr_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "page_ocr_text_trgm_idx" ON "page" USING gin ("ocr_text" gin_trgm_ops);