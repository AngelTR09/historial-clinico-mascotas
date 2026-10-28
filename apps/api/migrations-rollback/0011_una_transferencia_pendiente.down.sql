-- Rollback de 0011. Se pierden las fechas de creación y de cierre de las transferencias; las cesiones que la
-- migración canceló por duplicadas siguen canceladas.
DROP INDEX "transfers_pet_pending_idx";--> statement-breakpoint
ALTER TABLE "transfers" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "transfers" DROP COLUMN "completed_at";
