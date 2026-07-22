import type { RutaDiseñada } from "../models/rutaDiseñada";
import { obtenerColorCamion } from "../utils/ColoresCamion";
import "./diseñador.css";

export default function ResumenRutas({
  rutas,
  onEditar,
  onEliminar,
  onVer,
}: {
  rutas: RutaDiseñada[];
  onEditar: (ruta: RutaDiseñada) => void;
  onEliminar: (ruta: RutaDiseñada) => void | Promise<void>;
  onVer: (ruta: RutaDiseñada) => void;
}) {
  return (
    <aside className="resumen-rutas">
      <h3>Rutas diseñadas</h3>
      {rutas.length === 0 ? (
        <p>Aún no hay rutas guardadas.</p>
      ) : (
        rutas.map((ruta) => {
          const color = ruta.color ?? obtenerColorCamion(ruta.camion_id);

          return (
            <article className="ruta-resumen" key={ruta.ruta_id ?? ruta.camion_id}>
              <strong>
                <span className="swatch-ruta" style={{ backgroundColor: color }} />
                Camión {ruta.camion_id ?? "sin asignar"} · {ruta.nombre}
              </strong>
              <span>{ruta.descripcion}</span>
              <span>{ruta.puntos.length} puntos de coordenadas</span>
              <div>
                <button onClick={() => onVer(ruta)}>Ver</button>
                <button onClick={() => onEditar(ruta)}>Editar</button>
                <button className="boton-peligro" onClick={() => void onEliminar(ruta)}>
                  Eliminar
                </button>
              </div>
            </article>
          );
        })
      )}
    </aside>
  );
}
