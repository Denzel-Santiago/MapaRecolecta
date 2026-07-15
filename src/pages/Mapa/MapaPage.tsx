import { useState } from "react";
import MapaDiseñador from "../../components/MapaDiseñador";
import MapaMonitoreo from "../../components/MapaMonitoreo";
import { useRutasDiseñadas } from "../../hooks/useRutasDiseñadas";
import type { RutaDiseñada } from "../../models/rutaDiseñada";
import { puntosRutaACoordenadas } from "../../models/rutaDiseñada";
import { logout } from "../../services/authService";
import "./MapaPage.css";

export default function MapaPage({ onLogout }: { onLogout: () => void }) {
  const [vistaActual, setVistaActual] = useState<"diseñador" | "monitoreo">("diseñador");
  const [rutaMonitoreada, setRutaMonitoreada] = useState<RutaDiseñada>();
  const { rutasDiseñadas, guardarRuta, eliminarRuta, obtenerRutaPorCamion } = useRutasDiseñadas();

  const irAMonitoreo = (ruta: RutaDiseñada) => {
    setRutaMonitoreada(ruta);
    setVistaActual("monitoreo");
  };

  const cerrarSesion = () => {
    logout();
    setVistaActual("diseñador");
    setRutaMonitoreada(undefined);
    onLogout();
  };

  return (
    <div className="mapa-page">
      <div className="session-bar">
        <span>Sesion activa</span>
        <button type="button" onClick={cerrarSesion}>Cerrar sesion</button>
      </div>

      {vistaActual === "diseñador" ? (
        <MapaDiseñador
          rutas={rutasDiseñadas}
          guardarRuta={guardarRuta}
          eliminarRuta={eliminarRuta}
          obtenerRutaPorCamion={obtenerRutaPorCamion}
          irAMonitoreo={irAMonitoreo}
        />
      ) : (
        <MapaMonitoreo
          regresar={() => setVistaActual("diseñador")}
          ruta={rutaMonitoreada ? puntosRutaACoordenadas(rutaMonitoreada.puntos) : []}
        />
      )}
    </div>
  );
}
