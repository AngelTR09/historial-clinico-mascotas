ALTER TABLE "validations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "validations" CASCADE;--> statement-breakpoint
DROP INDEX "health_events_pending_validation_idx";--> statement-breakpoint
DROP TYPE "public"."decision_validacion";