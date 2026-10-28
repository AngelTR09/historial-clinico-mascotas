const UNIQUE_VIOLATION = "23505";

/**
 * Violación de unicidad de Postgres. postgres.js expone el SQLSTATE en
 * `error.code` (no `codigo`: es una propiedad de la librería, no nuestra, y
 * traducirla al castellano dejó sin efecto el reintento de `public_code`).
 */
export function esViolacionDeUnicidad(error) {
    return typeof error === "object" && error !== null && (error.code === UNIQUE_VIOLATION || error.cause?.code === UNIQUE_VIOLATION);
}
