-- Antes del índice único: si una mascota ya tiene varias cesiones pendientes (hasta ahora era posible), se conserva la que vence más tarde y se cancelan las demás.
UPDATE "transfers" SET "status" = 'cancelada' WHERE "status" = 'pendiente' AND "id" NOT IN (SELECT DISTINCT ON ("pet_id") "id" FROM "transfers" WHERE "status" = 'pendiente' ORDER BY "pet_id", "expires_at" DESC, "id");--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_pet_pending_idx" ON "transfers" USING btree ("pet_id") WHERE "transfers"."status" = 'pendiente';