import "../env.js";
import { construirPuertosLocales } from "../container.js";
import { TEMA_PROYECTOR } from "../domain/temas-cola.js";
import { reconstruirProyecciones } from "./projection-rebuild.js";
import { registrarTrabajadorProyector } from "./projector-worker.js";

// Simula en local la recarga que en AWS se dispara sobre la Lambda `proyector`: encola todas las
// mascotas y el proyector las escribe en la proyección en memoria. Falla si alguna queda sin proyectar.
const ports = construirPuertosLocales();
registrarTrabajadorProyector(ports);
const resultado = await reconstruirProyecciones(ports);
await ports.cola.esperarVacia();
const enDlq = ports.cola.fallidos(TEMA_PROYECTOR).length;
console.log(`Proyección: ${resultado.encolados} mascotas encoladas, ${ports.proyeccion.perfiles.size} proyectadas, ${enDlq} en la DLQ, ${resultado.fallidos} sin poder encolar`);
process.exit(enDlq > 0 || resultado.fallidos > 0 ? 1 : 0);
