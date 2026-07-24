CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_status_check" CHECK ("items"."status" IN ('open','done'))
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_billing" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text,
	"current_period_end" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_billing_plan_check" CHECK ("user_billing"."plan" IN ('free','pro'))
);
--> statement-breakpoint
CREATE TABLE "inngest_runs" (
	"event_id" text PRIMARY KEY NOT NULL,
	"run_id" text,
	"user_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "items_user_id_idx" ON "items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inngest_runs_user_status_idx" ON "inngest_runs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "inngest_runs_run_id_idx" ON "inngest_runs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "inngest_runs_updated_at_idx" ON "inngest_runs" USING btree ("updated_at");