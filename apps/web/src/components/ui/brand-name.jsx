/**
 * Nombre de la marca en dos líneas compactas, para que quepa junto al botón de la
 * cabecera en un celular de 360 px sin partirse a mitad de palabra.
 */
export function NombreMarca({ className = "" }) {
    return (<span className={`flex flex-col font-display text-base font-semibold leading-[1.05] tracking-tight sm:text-lg ${className}`}>
      <span>Historial Clínico</span>
      <span>Mascotas</span>
    </span>);
}

/** Logo (huella con QR). Decorativo: el nombre va escrito al lado, así que no repite texto para lectores de pantalla. */
export function LogoMarca({ className = "h-10 w-10" }) {
    return <img src="/img/logo.svg" alt="" width="40" height="39" className={`shrink-0 ${className}`}/>;
}
