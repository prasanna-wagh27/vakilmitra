ALTER TABLE "advocate" ADD COLUMN "cloud_ocr_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "advocate" ADD COLUMN "cloud_ocr_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "ocr_route" text;