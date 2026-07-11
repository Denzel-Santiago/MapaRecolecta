import { useState } from "react";
import "./App.css";
import MapaDiseñador from "./components/MapaDiseñador";
import MapaMonitoreo from "./components/MapaMonitoreo";
import { useRutasDiseñadas } from "./hooks/useRutasDiseñadas";
import type { RutaDiseñada } from "./models/rutaDiseñada";
import { puntosRutaACoordenadas } from "./models/rutaDiseñada";

function App() {
  const [vistaActual, setVistaActual] = useState<"diseñador" | "monitoreo">("diseñador");
  const [rutaMonitoreada, setRutaMonitoreada] = useState<RutaDiseñada>();
  const { rutasDiseñadas, guardarRuta, eliminarRuta, obtenerRutaPorCamion } = useRutasDiseñadas();
  const irAMonitoreo = (ruta: RutaDiseñada) => { setRutaMonitoreada(ruta); setVistaActual("monitoreo"); };

  return <>{vistaActual === "diseñador" ? <MapaDiseñador rutas={rutasDiseñadas} guardarRuta={guardarRuta} eliminarRuta={eliminarRuta} obtenerRutaPorCamion={obtenerRutaPorCamion} irAMonitoreo={irAMonitoreo} /> : <MapaMonitoreo regresar={() => setVistaActual("diseñador")} ruta={rutaMonitoreada ? puntosRutaACoordenadas(rutaMonitoreada.puntos) : []} />}</>;
}
export default App;
