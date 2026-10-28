-- Rollback de 0001. Pierde el nombre de las mascotas.
ALTER TABLE "pets" DROP COLUMN "name";
