-- Rollback de 0010. Se pierden las contraseñas, los códigos de verificación y el correo de los
-- veterinarios (vets.email): las cuentas vuelven a depender solo del token que emitió el registro.
DROP INDEX "owners_email_login_idx";--> statement-breakpoint
DROP INDEX "vets_email_login_idx";--> statement-breakpoint
DROP TABLE "email_verifications";--> statement-breakpoint
ALTER TABLE "owners" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "owners" DROP COLUMN "email_verified_at";--> statement-breakpoint
ALTER TABLE "owners" DROP COLUMN "failed_logins";--> statement-breakpoint
ALTER TABLE "owners" DROP COLUMN "locked_until";--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "email_verified_at";--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "failed_logins";--> statement-breakpoint
ALTER TABLE "vets" DROP COLUMN "locked_until";
