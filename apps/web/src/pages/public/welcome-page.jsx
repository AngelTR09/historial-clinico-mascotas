import { Activity, ArrowRight, Heart, PawPrint, QrCode, ShieldCheck, Stethoscope } from "lucide-react";
import { Link } from "react-router-dom";
import { LogoMarca, NombreMarca } from "../../components/ui/brand-name";
import { Revelar } from "../../components/ui/reveal-al-desplazar";

const CARACTERISTICAS = [
    {
        icono: Stethoscope,
        titulo: "Historial de salud",
        descripcion: "Vacunas, chequeos y tratamientos en un solo lugar, con la evidencia que los respalda.",
        imagen: "/img/historial-consulta.webp",
        altImagen: "Veterinaria con guantes revisando a un perro sobre la camilla de un consultorio",
        acento: "pine",
    },
    {
        icono: QrCode,
        titulo: "Placa con código QR",
        descripcion: "Solo un veterinario con sesión iniciada y cuenta aprobada puede abrirla. El acceso es solo a esa mascota, vence a las 4 horas y queda registrado. Ningún dato tuyo viaja en el código.",
        imagen: "/img/placa-qr.webp",
        altImagen: "Placa metálica con un código QR grabado, colgada del collar verde de un perro",
        acento: "pine",
    },
    {
        icono: ShieldCheck,
        titulo: "Con nivel de confianza",
        descripcion: "Tú puedes agregar vacunas y atenciones: quedan como «no validadas». Lo que registra un veterinario colegiado en consulta nace validado.",
        imagen: "/img/registro-confianza.webp",
        altImagen: "Veterinario con guantes azules escaneando con su celular el código QR del collar de un perro, mientras el dueño observa",
        acento: "gold",
    },
];

const PASOS = [
    { titulo: "Crea tu cuenta", descripcion: "Solo necesitas tu documento, tu correo y unos minutos." },
    { titulo: "Registra a tu mascota", descripcion: "Agrega sus datos y el historial de salud que ya tienes." },
    { titulo: "Obtén su placa QR", descripcion: "Descarga el archivo listo para grabar con láser, o imprímelo, y cuélgala del collar." },
];

// Clases por acento (el compilador de Tailwind necesita las clases completas, no interpoladas).
const ACENTOS = {
    pine: { chip: "bg-pine-tint text-pine group-hover:bg-pine group-hover:text-white", halo: "bg-pine/10" },
    gold: { chip: "bg-gold-tint text-gold group-hover:bg-gold group-hover:text-white", halo: "bg-gold/10" },
};

export function PaginaBienvenida() {
    return (<div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-transparent bg-paper/80 px-4 py-4 backdrop-blur-md sm:px-6">
        <span className="group flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <LogoMarca className="h-10 w-10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"/>
          <NombreMarca/>
        </span>
        <nav className="flex items-center gap-1" aria-label="Cuenta">
          <Link to="/login" className="flex min-h-11 items-center rounded-md px-2 text-sm text-ink-soft transition-colors hover:text-ink">
            Iniciar sesión
          </Link>
          <Link to="/vet" className="flex min-h-11 items-center rounded-md px-2 text-sm text-ink-soft transition-colors hover:text-ink">
            Soy veterinario
          </Link>
        </nav>
      </header>

      <main id="contenido">
        {/* HERO */}
        <section className="relative overflow-hidden">
          {/* Fondo vivo: dos halos que flotan y respiran, más un rastro de huellas. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-24 top-4 h-72 w-72 rounded-full bg-pine-tint blur-3xl animate-resplandor"/>
            <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-gold-tint blur-3xl animate-flotar-lento"/>
            <PawPrint className="absolute left-[8%] top-[26%] h-8 w-8 -rotate-12 text-pine/10 animate-flotar" style={{ animationDelay: "0.4s" }}/>
            <PawPrint className="absolute left-[18%] bottom-[16%] h-10 w-10 rotate-6 text-pine/10 animate-flotar" style={{ animationDelay: "1.6s" }}/>
            <PawPrint className="absolute right-[12%] top-[18%] h-9 w-9 rotate-12 text-gold/10 animate-flotar" style={{ animationDelay: "1s" }}/>
          </div>

          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 py-10 sm:grid-cols-2 sm:px-6 sm:py-20">
            <div>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-sand bg-paper-raised/70 px-3 py-1 text-xs font-medium text-ink-soft animate-entrada">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pine opacity-60"/>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-pine"/>
                </span>
                Registro Nacional de Identidad y Salud Animal
              </span>
              <h1 className="mb-4 font-display text-4xl font-semibold leading-[1.1] text-ink animate-entrada sm:text-5xl" style={{ animationDelay: "0.08s" }}>
                Cada mascota tiene una huella. Esta es la suya.
              </h1>
              <p className="mb-8 max-w-md text-base text-ink-soft animate-entrada sm:text-lg" style={{ animationDelay: "0.16s" }}>
                Construye y conserva el expediente de vacunas, chequeos y tratamientos de tu mascota, con las fotos de
                cartillas y recetas que lo respaldan. Cada mascota recibe una placa con QR: en la consulta, un veterinario aprobado
                la escanea y abre su expediente completo durante 4 horas, sin que tengas que reconstruir su historia de memoria.
              </p>
              <div className="flex flex-col gap-3 animate-entrada sm:flex-row" style={{ animationDelay: "0.24s" }}>
                <Link to="/register" className="group relative flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-md bg-pine px-5 font-medium text-white shadow-sm transition-all duration-300 hover:bg-pine-dark hover:shadow-lg hover:shadow-pine/20 active:scale-[0.98]">
                  {/* Destello que barre el botón al pasar el cursor. */}
                  <span aria-hidden="true" className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"/>
                  Registrar a mi mascota
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"/>
                </Link>
                <Link to="/vet" className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-sand-dark px-5 font-medium text-ink transition-all duration-300 hover:border-pine hover:bg-white hover:text-pine active:scale-[0.98]">
                  Soy veterinario
                </Link>
              </div>
            </div>

            {/* La mascota dentro de un visor de escáner: la placa con QR la identifica. */}
            <div className="order-first flex justify-center animate-entrada sm:order-none" style={{ animationDelay: "0.2s" }}>
              <div className="group relative">
                <div aria-hidden="true" className="absolute -inset-6 rounded-full bg-pine/5 blur-2xl animate-resplandor"/>
                <div className="relative w-64 overflow-hidden rounded-3xl border border-sand bg-paper-raised shadow-sm transition-transform duration-500 group-hover:-translate-y-1 group-hover:shadow-xl sm:w-80">
                  <img src="/img/portada-perro.webp" alt="Perro mestizo marrón y blanco con collar verde y placa" width="960" height="1200" fetchPriority="high" className="aspect-[4/5] w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"/>

                  {/* Línea de escaneo que barre la foto de arriba a abajo. */}
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                    <div className="h-14 w-full bg-gradient-to-b from-transparent via-white/30 to-transparent animate-escaneo"/>
                  </div>

                  {/* Esquinas del visor. */}
                  <span aria-hidden="true" className="absolute left-3 top-3 h-5 w-5 rounded-tl-lg border-l-2 border-t-2 border-white/80"/>
                  <span aria-hidden="true" className="absolute right-3 top-3 h-5 w-5 rounded-tr-lg border-r-2 border-t-2 border-white/80"/>
                  <span aria-hidden="true" className="absolute bottom-3 left-3 h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-white/80"/>
                  <span aria-hidden="true" className="absolute bottom-3 right-3 h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-white/80"/>

                  <div className="absolute inset-x-6 bottom-6 flex items-center justify-center gap-2 rounded-full bg-white/90 px-3 py-1.5 font-mono text-xs text-ink shadow-sm backdrop-blur">
                    <QrCode className="h-3.5 w-3.5 text-pine"/>
                    HCM·PE
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Signo vital: un latido que traza la línea, entre el hero y las características. */}
          <div aria-hidden="true" className="mx-auto flex max-w-5xl items-center gap-3 px-4 pb-8 sm:px-6">
            <Heart className="h-4 w-4 shrink-0 text-clay animate-latido"/>
            <svg viewBox="0 0 240 24" preserveAspectRatio="none" className="h-6 w-full">
              <polyline
                points="0,12 60,12 72,12 80,3 92,21 104,12 130,12 240,12"
                fill="none"
                stroke="var(--color-pine)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="240"
                className="animate-trazo"
                opacity="0.7"
              />
            </svg>
            <Activity className="h-4 w-4 shrink-0 text-pine"/>
          </div>
        </section>

        {/* CARACTERÍSTICAS */}
        <section className="border-y border-sand bg-paper-raised px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
            {CARACTERISTICAS.map(({ icono: Icono, titulo, descripcion, acento, imagen, altImagen }, index) => {
                const estilo = ACENTOS[acento];
                return (<Revelar key={titulo} retardoMs={index * 120} className="group relative overflow-hidden rounded-2xl border border-sand bg-paper p-6 transition-all duration-300 hover:-translate-y-1 hover:border-sand-dark hover:shadow-lg">
                    <div aria-hidden="true" className={`absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${estilo.halo}`}/>
                    {imagen && <img src={imagen} alt={altImagen} width="1200" height="896" loading="lazy" className="relative -mx-6 -mt-6 mb-5 h-36 w-[calc(100%+3rem)] max-w-none object-cover"/>}
                    <div className={`relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300 ${estilo.chip}`}>
                      <Icono className="h-6 w-6 transition-transform duration-300 group-hover:scale-110"/>
                    </div>
                    <h2 className="relative mb-1.5 font-display text-lg font-semibold text-ink">{titulo}</h2>
                    <p className="relative text-sm leading-relaxed text-ink-soft">{descripcion}</p>
                  </Revelar>);
            })}
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <Revelar comoEtiqueta="h2" className="mb-10 text-center font-display text-2xl font-semibold text-ink sm:text-3xl">
            Cómo funciona
          </Revelar>
          <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-3">
            {/* Rastro que conecta los tres pasos en escritorio. */}
            <div aria-hidden="true" className="absolute left-0 right-0 top-4 hidden h-px bg-gradient-to-r from-transparent via-sand-dark to-transparent sm:block"/>
            {PASOS.map((paso, index) => (<Revelar key={paso.titulo} retardoMs={index * 140} className="group relative flex gap-4 sm:flex-col sm:gap-3 sm:text-center">
                <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine font-display text-sm font-semibold text-white shadow-sm transition-transform duration-300 group-hover:scale-110 sm:mx-auto">
                  <span aria-hidden="true" className="absolute inline-flex h-full w-full rounded-full bg-pine opacity-0 transition-opacity duration-300 group-hover:animate-ping group-hover:opacity-40"/>
                  {index + 1}
                </span>
                <div>
                  <h3 className="mb-1 font-medium text-ink">{paso.titulo}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{paso.descripcion}</p>
                </div>
              </Revelar>))}
          </div>
        </section>

        {/* LLAMADA FINAL */}
        <section className="px-4 pb-14 sm:px-6">
          <Revelar className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-pine px-6 py-12 text-center shadow-sm sm:px-10 sm:py-16">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-white/5 blur-2xl animate-resplandor"/>
              <div className="absolute -bottom-12 right-0 h-56 w-56 rounded-full bg-gold/10 blur-3xl animate-flotar-lento"/>
              <PawPrint className="absolute right-[10%] top-[20%] h-10 w-10 rotate-12 text-white/5 animate-flotar"/>
            </div>
            <img src="/img/portada-perro.webp" alt="Perro mestizo marrón y blanco sentado en un parque, con collar verde y placa" width="960" height="1200" loading="lazy" className="relative mx-auto mb-5 h-24 w-24 rounded-full object-cover object-top ring-4 ring-white/30"/>
            <h2 className="relative mb-3 font-display text-2xl font-semibold text-white sm:text-3xl">
              Empieza el expediente de tu mascota hoy
            </h2>
            <p className="relative mx-auto mb-7 max-w-md text-pine-tint">
              Gratis, en minutos. Su historial de salud te acompaña toda la vida.
            </p>
            <Link to="/register" className="group relative inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-6 font-medium text-pine transition-all duration-300 hover:shadow-lg hover:shadow-black/10 active:scale-[0.98]">
              Registrar a mi mascota
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"/>
            </Link>
          </Revelar>
        </section>
      </main>

      <footer className="border-t border-sand px-4 py-6 text-center text-sm text-ink-faint sm:px-6">
        Historial Clínico Mascotas · Registro Nacional de Identidad y Salud Animal
      </footer>
    </div>);
}
