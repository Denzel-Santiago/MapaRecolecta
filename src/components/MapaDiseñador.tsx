import { useState } from "react";
import MapaDiseñadorView from "./MapaDiseñadorView";
import SeleccionCamionModal from "./SeleccionCamionModal";
import RutaFormModal from "./RutaFormModal";
import ResumenRutas from "./ResumenRutas";
import { useRutaDiseñador } from "../hooks/useRutaDiseñador";
import type { DatosRutaForm, RutaDiseñada } from "../models/rutaDiseñada";
import { puntosRutaACoordenadas } from "../models/rutaDiseñada";
import { crearRutaDiseñada } from "../services/rutaService";
import { guardarRuta as guardarRutaApi } from "../services/rutasApi";
import "./diseñador.css";

export default function MapaDiseñador({ rutas, obtenerRutaPorCamion, guardarRuta, eliminarRuta, irAMonitoreo }: {
  rutas: RutaDiseñada[];
  obtenerRutaPorCamion: (camionId: number) => RutaDiseñada | undefined;
  guardarRuta: (ruta: RutaDiseñada) => void;
  eliminarRuta: (camionId: number) => void;
  irAMonitoreo: (ruta: RutaDiseñada) => void;
}) {
  const [camionId, setCamionId] = useState<number | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [rutaEditada, setRutaEditada] = useState<RutaDiseñada>();
  const { puntos, error, agregarPunto, deshacerUltimo, limpiarRuta, reemplazarPuntos, editarPunto, puedeGuardar } = useRutaDiseñador();

  const seleccionarCamion = (id: number) => {
    setCamionId(id);
    setRutaEditada(undefined);
    reemplazarPuntos([]);
  };
  const editar = (ruta: RutaDiseñada) => {
    setCamionId(ruta.camion_id);
    setRutaEditada(ruta);
    reemplazarPuntos(puntosRutaACoordenadas(ruta.puntos));
  };
  const ver = (ruta: RutaDiseñada) => reemplazarPuntos(puntosRutaACoordenadas(ruta.puntos));
  const guardar = async (datos: DatosRutaForm) => {
    if (camionId === null) return;

    const existente = obtenerRutaPorCamion(camionId);
    if (
      existente &&
      existente !== rutaEditada &&
      !window.confirm(`El Camión ${camionId} ya tiene una ruta asignada.\n\n¿Desea reemplazarla?`)
    ) {
      return;
    }

    const rutaLocal = crearRutaDiseñada(camionId, datos, puntos);

    console.group("[MapaDiseñador] Guardar ruta");
    console.log("camionId:", camionId);
    console.log("datos formulario:", datos);
    console.log("puntos del mapa:", puntos);
    console.log("rutaDiseñada local:", rutaLocal);
    console.groupEnd();

    const respuesta = await guardarRutaApi(rutaLocal);

    console.log("[MapaDiseñador] ruta_id recibido:", respuesta.data?.ruta_id);

    guardarRuta({
      ...rutaLocal,
      ruta_id: respuesta.data.ruta_id,
    });
    setMostrarFormulario(false);
    setRutaEditada(undefined);
  };
  const eliminar = (ruta: RutaDiseñada) => {
    if (!window.confirm(`¿Eliminar la ruta del Camión ${ruta.camion_id}?`)) return;
    eliminarRuta(ruta.camion_id);
    if (camionId === ruta.camion_id) { limpiarRuta(); setRutaEditada(undefined); }
  };

  return <div style={{ height: "100vh", width: "100%", position: "relative" }}>
    <div className="panel-diseñador"><h3>Diseñador de Rutas</h3><p>{camionId ? `Camión ${camionId}` : "Seleccione un camión"}</p>{error && <p style={{ color: "#d32f2f" }}>{error}</p>}
      <div className="acciones"><button onClick={deshacerUltimo} disabled={!camionId || puntos.length === 0}>Deshacer</button><button onClick={limpiarRuta} disabled={!camionId || puntos.length === 0}>Limpiar</button><button onClick={() => setMostrarFormulario(true)} disabled={!camionId || !puedeGuardar}>Finalizar Ruta</button>{rutaEditada && <button onClick={() => setMostrarFormulario(true)}>Editar formulario</button>}<button onClick={() => { setCamionId(null); setRutaEditada(undefined); limpiarRuta(); }}>Cambiar camión</button></div>
    </div>
    <ResumenRutas rutas={rutas} onEditar={editar} onEliminar={eliminar} onVer={ver} />
    <MapaDiseñadorView puntos={puntos} onAddPoint={agregarPunto} onEditPoint={editarPunto} puedeDibujar={camionId !== null} />
    {camionId === null && <SeleccionCamionModal onConfirmar={seleccionarCamion} />}
    {mostrarFormulario && camionId !== null && <RutaFormModal camionId={camionId} ruta={rutaEditada} onCancelar={() => setMostrarFormulario(false)} onGuardar={guardar} />}
    {rutas.length > 0 && <button className="boton-primario" style={{ position: "absolute", zIndex: 1000, left: 14, bottom: 14 }} onClick={() => irAMonitoreo((camionId !== null ? obtenerRutaPorCamion(camionId) : undefined) ?? rutas[0])}>Ir a Monitoreo 🚛</button>}
  </div>;
}
