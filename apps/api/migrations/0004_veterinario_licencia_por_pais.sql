ALTER TABLE "vets" ADD COLUMN "country" text DEFAULT 'PE' NOT NULL;--> statement-breakpoint
ALTER TABLE "vets" ADD COLUMN "issuing_authority" text;--> statement-breakpoint
ALTER TABLE "vets" ADD COLUMN "license_number" text;--> statement-breakpoint
ALTER TABLE "vets" ADD COLUMN "tax_id" text;--> statement-breakpoint
-- Las cuentas existentes son todas peruanas: la colegiatura era del CMVP y el RUC, el identificador fiscal.
UPDATE "vets" SET "issuing_authority" = 'CMVP', "license_number" = "colegiatura", "tax_id" = "ruc";
