ALTER TABLE "draft" ADD COLUMN "property_id" text;--> statement-breakpoint
ALTER TABLE "draft" ADD COLUMN "approved_by_id" text;--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft" ADD CONSTRAINT "draft_approved_by_id_advocate_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."advocate"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "draft_property_template_idx" ON "draft" USING btree ("property_id","template");