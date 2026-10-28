-- Rollback de 0007. Los valores de microchip_iso borrados no se recuperan: restaurar desde el respaldo si importan.
ALTER TABLE "pets" ADD COLUMN "microchip_iso" text;
