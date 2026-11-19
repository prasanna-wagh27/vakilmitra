CREATE TYPE "public"."billing_interval" AS ENUM('MONTHLY', 'YEARLY');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('TRIAL', 'SOLO', 'PRO', 'CHAMBER');--> statement-breakpoint
CREATE SEQUENCE "public"."invoice_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "checkout" (
	"id" text PRIMARY KEY NOT NULL,
	"advocate_id" text NOT NULL,
	"plan" "plan" NOT NULL,
	"interval" "billing_interval" NOT NULL,
	"razorpay_order_id" text,
	"razorpay_subscription_id" text,
	"amount_paise" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_razorpay_order_id_unique" UNIQUE("razorpay_order_id"),
	CONSTRAINT "checkout_razorpay_subscription_id_unique" UNIQUE("razorpay_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"advocate_id" text,
	"number" text NOT NULL,
	"plan" "plan" NOT NULL,
	"interval" "billing_interval" NOT NULL,
	"amount_paise" integer NOT NULL,
	"cgst_paise" integer NOT NULL,
	"sgst_paise" integer NOT NULL,
	"igst_paise" integer NOT NULL,
	"total_paise" integer NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"billing_name" text NOT NULL,
	"billing_email" text NOT NULL,
	"gstin" text,
	"billing_state" text,
	"status" text DEFAULT 'PAID' NOT NULL,
	"razorpay_payment_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_number_unique" UNIQUE("number"),
	CONSTRAINT "invoice_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"advocate_id" text PRIMARY KEY NOT NULL,
	"plan" "plan" DEFAULT 'TRIAL' NOT NULL,
	"interval" "billing_interval",
	"trial_ends_at" timestamp with time zone NOT NULL,
	"paid_until" timestamp with time zone,
	"razorpay_subscription_id" text,
	"payment_failing" boolean DEFAULT false NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"complimentary" boolean DEFAULT false NOT NULL,
	"billing_name" text,
	"gstin" text,
	"billing_state" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_razorpay_subscription_id_unique" UNIQUE("razorpay_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_advocate_id_advocate_id_fk" FOREIGN KEY ("advocate_id") REFERENCES "public"."advocate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_advocate_id_advocate_id_fk" FOREIGN KEY ("advocate_id") REFERENCES "public"."advocate"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_advocate_id_advocate_id_fk" FOREIGN KEY ("advocate_id") REFERENCES "public"."advocate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkout_advocate_idx" ON "checkout" USING btree ("advocate_id");--> statement-breakpoint
CREATE INDEX "invoice_advocate_idx" ON "invoice" USING btree ("advocate_id","created_at");