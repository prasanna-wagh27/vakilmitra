ALTER TABLE "fact" ADD COLUMN "original_value" text;--> statement-breakpoint
ALTER TABLE "fact" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ownership_event" ADD COLUMN "document_id" text;--> statement-breakpoint
ALTER TABLE "ownership_event" ADD CONSTRAINT "ownership_event_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fact_document_idx" ON "fact" USING btree ("document_id");