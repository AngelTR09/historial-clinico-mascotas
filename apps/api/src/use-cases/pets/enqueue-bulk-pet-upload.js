/**
 * RF/RNF: carga masiva de albergue, hasta 100 expedientes en <60 s, sin
 * bloquear al resto (sección 10/12). El encolado es instantáneo — la
 * creación real de cada mascota ocurre después, en
 * `bulk-pet-upload-worker`, así que esta función nunca espera a que
 * ninguna mascota exista todavía.
 */
export async function encolarCargaMasivaMascotas(ports, idDueno, input) {
    const trabajo = { idDueno: idDueno, mascotas: input.mascotas };
    ports.cola.enqueue("bulk-pet-upload", trabajo);
    return { encolados: input.mascotas.length };
}
