import { useState } from "react";
import "./App.css";
import MapaDiseñador from "./components/MapaDiseñador";
import MapaMonitoreo from "./components/MapaMonitoreo";
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { useRutasDiseñadas } from "./hooks/useRutasDiseñadas";
import type { RutaDiseñada } from "./models/rutaDiseñada";
import { puntosRutaACoordenadas } from "./models/rutaDiseñada";
import { getAuthSession, logout, type AuthSession } from "./services/authService";

function App() {
  const [vistaActual, setVistaActual] = useState<"diseñador" | "monitoreo">("diseñador");
  const [rutaMonitoreada, setRutaMonitoreada] = useState<RutaDiseñada>();
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());
  const { rutasDiseñadas, guardarRuta, eliminarRuta, obtenerRutaPorCamion } = useRutasDiseñadas();
  const irAMonitoreo = (ruta: RutaDiseñada) => { setRutaMonitoreada(ruta); setVistaActual("monitoreo"); };
  const cerrarSesion = () => {
    logout();
    setSession(null);
    setVistaActual("diseñador");
    setRutaMonitoreada(undefined);
  };

  return (
    <ProtectedRoute session={session} fallback={<Login onAuthenticated={setSession} />}>
      <div style={{ minHeight: "100vh", position: "relative" }}>
        <div className="session-bar">
          <span>Sesion activa</span>
          <button type="button" onClick={cerrarSesion}>Cerrar sesion</button>
        </div>
        {vistaActual === "diseñador" ? <MapaDiseñador rutas={rutasDiseñadas} guardarRuta={guardarRuta} eliminarRuta={eliminarRuta} obtenerRutaPorCamion={obtenerRutaPorCamion} irAMonitoreo={irAMonitoreo} /> : <MapaMonitoreo regresar={() => setVistaActual("diseñador")} ruta={rutaMonitoreada ? puntosRutaACoordenadas(rutaMonitoreada.puntos) : []} />}
      </div>
    </ProtectedRoute>
  );
}
export default App;
