/**
 * Ilustraciones propias de Historial Clínico Mascotas (SVG, sin depender de imágenes externas): mismas tintas
 * que el sistema de diseño, trazo plano y sin ojos hundidos ni caricatura. Son decorativas,
 * por eso van `aria-hidden`.
 */

export function RetratoPerro({ className = "" }) {
    return (<svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <circle cx="100" cy="100" r="96" fill="var(--color-pine-tint)"/>
      {/* Orejas caídas */}
      <path d="M52 62c-22 6-30 40-22 66 4 12 18 14 26 4 8-12 10-40 8-60-1-8-6-12-12-10z" fill="var(--color-gold-dark)"/>
      <path d="M148 62c22 6 30 40 22 66-4 12-18 14-26 4-8-12-10-40-8-60 1-8 6-12 12-10z" fill="var(--color-gold-dark)"/>
      {/* Cabeza */}
      <ellipse cx="100" cy="100" rx="46" ry="52" fill="var(--color-gold)"/>
      {/* Hocico */}
      <ellipse cx="100" cy="126" rx="26" ry="20" fill="var(--color-gold-tint)"/>
      {/* Mancha en el ojo */}
      <circle cx="78" cy="88" r="14" fill="var(--color-gold-dark)" opacity="0.55"/>
      <circle cx="78" cy="88" r="5" fill="var(--color-ink)"/>
      <circle cx="122" cy="88" r="5" fill="var(--color-ink)"/>
      <path d="M92 116h16l-8 11z" fill="var(--color-ink)"/>
      <path d="M100 127v7M90 138c6 5 14 5 20 0" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    </svg>);
}

export function RetratoGato({ className = "" }) {
    return (<svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <circle cx="100" cy="100" r="96" fill="var(--color-clay-tint)"/>
      {/* Orejas puntiagudas */}
      <path d="M52 92 56 40l36 24z" fill="var(--color-ink-soft)"/>
      <path d="M148 92l-4-52-36 24z" fill="var(--color-ink-soft)"/>
      <path d="M60 78l2-24 16 11z" fill="var(--color-clay-tint)"/>
      <path d="M140 78l-2-24-16 11z" fill="var(--color-clay-tint)"/>
      {/* Cabeza */}
      <ellipse cx="100" cy="112" rx="54" ry="48" fill="var(--color-ink-soft)"/>
      <ellipse cx="100" cy="128" rx="24" ry="18" fill="var(--color-paper)"/>
      <ellipse cx="78" cy="106" rx="7" ry="9" fill="var(--color-gold-tint)"/>
      <ellipse cx="122" cy="106" rx="7" ry="9" fill="var(--color-gold-tint)"/>
      <ellipse cx="78" cy="107" rx="2.5" ry="7" fill="var(--color-ink)"/>
      <ellipse cx="122" cy="107" rx="2.5" ry="7" fill="var(--color-ink)"/>
      <path d="M94 121h12l-6 7z" fill="var(--color-clay)"/>
      <path d="M100 128v5M92 136c4 3 12 3 16 0" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Bigotes */}
      <path d="M70 128 40 122M70 134l-30 6M130 128l30-6M130 134l30 6" stroke="var(--color-paper)" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>);
}

// Matriz 9×9 fija con aire de código QR (no codifica nada: es ilustración, nunca un QR real).
const MATRIZ_QR = [
    "111111101", "100000101", "101110101", "101110100", "101110101",
    "100000100", "111111101", "000101010", "110010111",
];

/** Placa del collar con un QR ilustrativo — el objeto que explica el producto. */
export function PlacaQr({ className = "" }) {
    return (<svg viewBox="0 0 160 190" className={className} aria-hidden="true">
      {/* Argolla */}
      <circle cx="80" cy="22" r="14" fill="none" stroke="var(--color-sand-dark)" strokeWidth="5"/>
      <rect x="10" y="32" width="140" height="150" rx="26" fill="var(--color-paper-raised)" stroke="var(--color-pine)" strokeWidth="4"/>
      <rect x="34" y="52" width="92" height="92" rx="8" fill="var(--color-pine-tint)"/>
      {MATRIZ_QR.flatMap((fila, y) => [...fila].map((celda, x) => celda === "1" && (<rect key={`${x}-${y}`} x={41 + x * 8.6} y={59 + y * 8.6} width="7.4" height="7.4" rx="1.4" fill="var(--color-pine-dark)"/>)))}
      <path d="M80 164c-9-7-14-11-14-16 0-4 3-6 7-6 3 0 6 2 7 4 1-2 4-4 7-4 4 0 7 2 7 6 0 5-5 9-14 16z" fill="var(--color-clay)"/>
    </svg>);
}
