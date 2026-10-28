import { Navigate, Route, Routes } from "react-router-dom";
import { RequiereAutenticacion } from "./components/auth/require-auth";
import { RequiereAutenticacionVeterinario } from "./components/auth/require-vet-auth";
import { PaginaPanel } from "./pages/owner/dashboard-page";
import { PaginaInicioSesion } from "./pages/auth/login-page";
import { PaginaDetalleMascota } from "./pages/owner/pet-detail-page";
import { PaginaPerfilPublico } from "./pages/public/public-profile-page";
import { PaginaRegistro } from "./pages/auth/register-page";
import { PaginaPanelVeterinario } from "./pages/vet/vet-dashboard-page";
import { PaginaVerificacionCorreo } from "./pages/auth/verify-page";
import { PaginaMascotaVeterinario } from "./pages/vet/vet-pet-page";
import { PaginaRegistrarMascotaVeterinario } from "./pages/vet/vet-register-pet-page";
import { PaginaRegistroVeterinario } from "./pages/vet/vet-register-page";
import { PaginaBienvenida } from "./pages/public/welcome-page";
export function App() {
    return (<>
    <a href="#contenido" className="skip-link">Saltar al contenido</a>
    <Routes>
      <Route path="/" element={<PaginaBienvenida />}/>
      <Route path="/register" element={<PaginaRegistro />}/>
      <Route path="/login" element={<PaginaInicioSesion />}/>
      <Route path="/verificar" element={<PaginaVerificacionCorreo />}/>
      <Route path="/dashboard" element={<RequiereAutenticacion>
            <PaginaPanel />
          </RequiereAutenticacion>}/>
      <Route path="/pets/:petId" element={<RequiereAutenticacion>
            <PaginaDetalleMascota />
          </RequiereAutenticacion>}/>
      <Route path="/p/:qrToken" element={<PaginaPerfilPublico />}/>

      <Route path="/vet" element={<PaginaRegistroVeterinario />}/>
      <Route path="/vet/dashboard" element={<RequiereAutenticacionVeterinario>
            <PaginaPanelVeterinario />
          </RequiereAutenticacionVeterinario>}/>
      <Route path="/vet/pets/new" element={<RequiereAutenticacionVeterinario>
            <PaginaRegistrarMascotaVeterinario />
          </RequiereAutenticacionVeterinario>}/>
      <Route path="/vet/pets/:petId" element={<RequiereAutenticacionVeterinario>
            <PaginaMascotaVeterinario />
          </RequiereAutenticacionVeterinario>}/>

      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
    </>);
}
