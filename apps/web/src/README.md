# apps/web/src

React + Vite + Tailwind. Las páginas **componen**; los componentes no importan páginas (lo vigila ESLint).

| Carpeta | Qué hay |
|---|---|
| `pages/auth/` | Login, registro de dueño, verificación de código. |
| `pages/owner/` | Panel del dueño y detalle de mascota. |
| `pages/vet/` | Panel del veterinario, expediente, registro de veterinario y de mascota. |
| `pages/public/` | Bienvenida y ficha pública por QR (sin sesión). |
| `components/ui/` | Piezas genéricas sin dominio: encabezados, banners, esqueletos, ilustraciones. |
| `components/auth/` | Guardas de ruta y campos de contraseña. |
| `components/pets/` | Piezas de mascota: avatar, foto, datos públicos. |
| `components/vet/` | Formulario de atención, encabezado del veterinario, escáner QR. |
| `components/offline/` | Aviso de la cola de subidas pendientes. |
| `api/` | Cliente HTTP (único lugar que habla con la API). |
| `hooks/`, `lib/` | Hooks y lógica sin JSX (cola offline en IndexedDB, QR de la placa, fotos). |
