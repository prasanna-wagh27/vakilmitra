ALTER TABLE "fee_agreement" DROP CONSTRAINT "fee_agreement_case_id_case_file_id_fk";
--> statement-breakpoint
ALTER TABLE "flag" ADD COLUMN "rule_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "page" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "fee_agreement" ADD CONSTRAINT "fee_agreement_case_id_case_file_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_file"("id") ON DELETE set null ON UPDATE no action;