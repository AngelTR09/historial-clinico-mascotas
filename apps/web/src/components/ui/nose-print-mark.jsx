/**
 * El motivo de la marca es la nariz del animal, cuya textura es
 * única para cada individuo, igual que la huella dactilar en las personas.
 * Este es el único lugar del sitio donde ese motivo
 * aparece como ilustración — el momento de "gastar el atrevimiento" en un
 * solo sitio en vez de repetirlo por todas partes. La forma es la nariz
 * vista de frente (más ancha que alta, fosas en diagonal, surco central),
 * no una cara: las fosas no deben leerse como ojos.
 *
 * Con `animada`, el conjunto "respira" y las motas titilan de forma
 * escalonada — la huella nasal como signo de un animal vivo. Sin la prop,
 * la ilustración es estática (por ejemplo en la ficha pública impresa).
 */
export function MarcaHuellaNasal({ className = "", animada = false }) {
    return (<svg viewBox="0 0 200 200" className={`${animada ? "origin-center animate-respirar" : ""} ${className}`.trim()} aria-hidden="true">
      <ellipse cx="100" cy="104" rx="86" ry="60" fill="var(--color-pine-tint)" stroke="var(--color-pine)" strokeWidth="2.5"/>

      {/* Fosas nasales: óvalos alargados en diagonal, no círculos — así no se leen como ojos. */}
      <ellipse cx="76" cy="96" rx="8" ry="17" fill="var(--color-pine)" transform="rotate(-24 76 96)"/>
      <ellipse cx="124" cy="96" rx="8" ry="17" fill="var(--color-pine)" transform="rotate(24 124 96)"/>

      {/* Surco central, recto, no una curva de sonrisa. */}
      <line x1="100" y1="104" x2="100" y2="130" stroke="var(--color-pine)" strokeWidth="3" strokeLinecap="round"/>

      {/* Textura: la huella única de la nariz, motas irregulares, nunca una grilla. */}
      {[
            [55, 60, 4],
            [80, 52, 3],
            [120, 53, 3.5],
            [146, 62, 4],
            [158, 88, 3.5],
            [152, 116, 4],
            [134, 138, 3],
            [104, 144, 3.5],
            [70, 140, 3],
            [46, 122, 4],
            [40, 92, 3.5],
            [64, 78, 2.5],
            [140, 80, 3],
            [116, 132, 2.5],
            [86, 132, 2.5],
            [64, 108, 3],
            [136, 108, 3],
        ].map(([cx, cy, r], i) => (<circle key={i} cx={cx} cy={cy} r={r} fill="var(--color-pine)" opacity={0.4} className={animada ? "animate-titilar" : undefined} style={animada ? { animationDelay: `${(i % 6) * 0.45}s` } : undefined}/>))}
    </svg>);
}
