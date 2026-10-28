import { openDB } from "idb";
let promesaBd = null;
function obtenerBd() {
    promesaBd ??= openDB("hcm-offline", 1, {
        upgrade(db) {
            const store = db.createObjectStore("pending-uploads", { keyPath: "id" });
            store.createIndex("idMascota", "idMascota");
        },
    });
    return promesaBd;
}
export async function encolarSubidaPendiente(entrada) {
    const db = await obtenerBd();
    await db.put("pending-uploads", entrada);
}
export async function listarSubidasPendientes() {
    const db = await obtenerBd();
    const todas = await db.getAll("pending-uploads");
    return todas.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}
export async function listarSubidasPendientesDeMascota(idMascota) {
    const db = await obtenerBd();
    const deLaMascota = await db.getAllFromIndex("pending-uploads", "idMascota", idMascota);
    return deLaMascota.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}
export async function eliminarSubidaPendiente(id) {
    const db = await obtenerBd();
    await db.delete("pending-uploads", id);
}
export async function marcarErrorSubidaPendiente(id, mensaje) {
    const db = await obtenerBd();
    const existente = await db.get("pending-uploads", id);
    if (!existente)
        {return;}
    await db.put("pending-uploads", { ...existente, intentos: existente.intentos + 1, ultimoError: mensaje });
}
