-- Rollback de 0012. Se pierden las contraseñas que esperaban verificación en un reclamo de cuenta:
-- quien estuviera a medias tendrá que registrarse otra vez para recibir un código nuevo.
ALTER TABLE "email_verifications" DROP COLUMN "pending_password_hash";
