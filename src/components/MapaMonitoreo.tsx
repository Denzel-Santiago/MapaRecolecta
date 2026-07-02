import MapaMonitoreoView from "./MapaMonitoreoView";
import { useMonitoreo } from "../hooks/useMonitoreo";
import type { Coordenada } from "../models/geo";

export default function MapaMonitoreo({
  regresar,
  ruta,
}: {
  regresar: () => void;
  ruta: Coordenada[];
}) {
  const { posicionCamion, rutaRecorrida, porcentajeAvance, ultimaActualizacion } = useMonitoreo(ruta);

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          zIndex: 999,
          top: 14,
          left: 14,
          background: "white",
          padding: "12px",
          borderRadius: "12px",
          width: "280px",
        }}
      >
        <h3>Monitoreo</h3>

        <button onClick={regresar}>← Volver al Diseñador</button>

        <div style={{ marginTop: "12px" }}>
          <p>Avance: {porcentajeAvance}%</p>
          <p>Última actualización: {ultimaActualizacion}</p>
        </div>
      </div>

      <MapaMonitoreoView ruta={ruta} rutaRecorrida={rutaRecorrida} posicionCamion={posicionCamion} />
    </div>
  );
}
