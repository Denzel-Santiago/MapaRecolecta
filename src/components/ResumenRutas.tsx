import type { RutaDiseñada } from "../models/rutaDiseñada";
import "./diseñador.css";
export default function ResumenRutas({ rutas, onEditar, onEliminar, onVer }: { rutas: RutaDiseñada[]; onEditar: (ruta: RutaDiseñada) => void; onEliminar: (ruta: RutaDiseñada) => void; onVer: (ruta: RutaDiseñada) => void; }) {
  return <aside className="resumen-rutas"><h3>Rutas diseñadas</h3>{rutas.length === 0 ? <p>Aún no hay rutas guardadas.</p> : rutas.map((ruta) => <article className="ruta-resumen" key={ruta.camion_id}><strong>Camión {ruta.camion_id} · {ruta.nombre}</strong><span>{ruta.zona} · {ruta.turno}</span><span>{ruta.puntos.length} puntos · {ruta.estado}</span><span>{ruta.fecha}</span><div><button onClick={() => onVer(ruta)}>Ver</button><button onClick={() => onEditar(ruta)}>Editar</button><button className="boton-peligro" onClick={() => onEliminar(ruta)}>Eliminar</button></div></article>)}</aside>;
}
