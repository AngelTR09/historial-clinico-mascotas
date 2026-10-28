-- Rollback de 0002: las filas con razon_social NULL reciben cadena vacía para poder volver a NOT NULL.
UPDATE "vets" SET "razon_social" = '' WHERE "razon_social" IS NULL;--> statement-breakpoint
ALTER TABLE "vets" ALTER COLUMN "razon_social" SET NOT NULL;
