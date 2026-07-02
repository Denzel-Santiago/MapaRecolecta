import MapaDiseñadorView from "./MapaDiseñadorView";
import { useRutaDiseñador } from "../hooks/useRutaDiseñador";
import type { Coordenada } from "../models/geo";

export default function MapaDiseñador({
  cambiarVista,
  guardarRuta,
}: {
  cambiarVista: () => void;
  guardarRuta: (ruta: Coordenada[]) => void;
}) {
  const { puntos, error, agregarPunto, deshacerUltimo, limpiarRuta, puedeGuardar } = useRutaDiseñador();

  const irAMonitoreo = () => {
    if (!puedeGuardar) return;
    guardarRuta(puntos);
    cambiarVista();
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          zIndex: 999,
          top: 14,
          left: 14,
          background: "white",
          padding: "14px",
          borderRadius: "12px",
          width: "280px",
        }}
      >
        <h3>Diseñador de Rutas</h3>

        {error ? <p style={{ color: "#d32f2f" }}>{error}</p> : null}

        <button onClick={deshacerUltimo} disabled={puntos.length === 0}>
          Deshacer
        </button>

        <button onClick={limpiarRuta} disabled={puntos.length === 0}>
          Limpiar
        </button>

        <button
          style={{ marginTop: "10px", width: "100%" }}
          onClick={irAMonitoreo}
          disabled={!puedeGuardar}
        >
          Ir a Monitoreo 🚛
        </button>
      </div>

      <MapaDiseñadorView puntos={puntos} onAddPoint={agregarPunto} />
    </div>
  );
}
