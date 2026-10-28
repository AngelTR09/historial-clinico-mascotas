-- Rollback de 0003.
ALTER TABLE "owners" ADD COLUMN "identity_verified" boolean DEFAULT false NOT NULL;
