import { useState } from "react";
import MapaDiseñadorView from "./MapaDiseñadorView";
import SeleccionCamionModal from "./SeleccionCamionModal";
import RutaFormModal from "./RutaFormModal";
import ResumenRutas from "./ResumenRutas";
import { useRutaDiseñador } from "../hooks/useRutaDiseñador";
import type { DatosRutaForm, RutaDiseñada } from "../models/rutaDiseñada";
import { puntosRutaACoordenadas } from "../models/rutaDiseñada";
import { crearRutaDiseñada } from "../services/rutaService";
import {
  actualizarRuta as actualizarRutaApi,
  backendToRutaDiseñada,
  guardarRuta as guardarRutaApi,
} from "../services/rutasApi";
import "./diseñador.css";

function esMismaRuta(a: RutaDiseñada, b?: RutaDiseñada): boolean {
  if (!b) return false;
  if (a.ruta_id !== null && b.ruta_id !== null) return a.ruta_id === b.ruta_id;
  return a.camion_id === b.camion_id;
}

export default function MapaDiseñador({
  rutas,
  rutasVisibles,
  cargando,
  errorRutas,
  rutaSeleccionadaId,
  obtenerRutaPorCamion,
  guardarRuta,
  eliminarRuta,
  seleccionarRuta,
  verTodas,
  irAMonitoreo,
}: {
  rutas: RutaDiseñada[];
  rutasVisibles: RutaDiseñada[];
  cargando: boolean;
  errorRutas: string | null;
  rutaSeleccionadaId: number | null;
  obtenerRutaPorCamion: (camionId: number) => RutaDiseñada | undefined;
  guardarRuta: (ruta: RutaDiseñada) => void;
  eliminarRuta: (ruta: RutaDiseñada) => Promise<void>;
  seleccionarRuta: (rutaId: number | null) => void;
  verTodas: () => void;
  irAMonitoreo: (ruta: RutaDiseñada) => void;
}) {
  const [camionId, setCamionId] = useState<number | null>(null);
  const [mostrarSeleccionCamion, setMostrarSeleccionCamion] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [rutaEditada, setRutaEditada] = useState<RutaDiseñada>();
  const { puntos, error, agregarPunto, deshacerUltimo, limpiarRuta, reemplazarPuntos, editarPunto, puedeGuardar } =
    useRutaDiseñador();

  const seleccionarCamion = (id: number) => {
    const rutaExistente = obtenerRutaPorCamion(id);

    setCamionId(id);
    setMostrarSeleccionCamion(false);
    setRutaEditada(rutaExistente);
    reemplazarPuntos(rutaExistente ? puntosRutaACoordenadas(rutaExistente.puntos) : []);

    if (rutaExistente?.ruta_id !== null && rutaExistente?.ruta_id !== undefined) {
      seleccionarRuta(rutaExistente.ruta_id);
    }
  };

  const editar = (ruta: RutaDiseñada) => {
    setCamionId(ruta.camion_id);
    setRutaEditada(ruta);
    reemplazarPuntos(puntosRutaACoordenadas(ruta.puntos));

    if (ruta.ruta_id !== null) {
      seleccionarRuta(ruta.ruta_id);
    }
  };

  const ver = (ruta: RutaDiseñada) => {
    reemplazarPuntos([]);
    setRutaEditada(undefined);
    setCamionId(null);
    setMostrarSeleccionCamion(false);

    if (ruta.ruta_id !== null) {
      seleccionarRuta(ruta.ruta_id);
    }
  };

  const guardar = async (datos: DatosRutaForm) => {
    if (camionId === null) return;

    const existente = obtenerRutaPorCamion(camionId);
    if (
      existente &&
      !esMismaRuta(existente, rutaEditada) &&
      !window.confirm(`El Camión ${camionId} ya tiene una ruta asignada.\n\n¿Desea reemplazarla?`)
    ) {
      return;
    }

    const rutaBase = crearRutaDiseñada(camionId, datos, puntos, rutaEditada?.ruta_id ?? null);
    const rutaLocal = {
      ...rutaBase,
      color: rutaEditada?.color ?? rutaBase.color,
    };

    const rutaGuardada =
      rutaLocal.ruta_id !== null
        ? await actualizarRutaApi(rutaLocal)
        : backendToRutaDiseñada((await guardarRutaApi(rutaLocal)).data);

    const rutaFinal = {
      ...rutaLocal,
      ...rutaGuardada,
      puntos: rutaGuardada.puntos.length > 0 ? rutaGuardada.puntos : rutaLocal.puntos,
      color: rutaGuardada.color ?? rutaLocal.color,
      visible: true,
    };

    guardarRuta(rutaFinal);
    setMostrarFormulario(false);
    setRutaEditada(rutaFinal);

    if (rutaFinal.ruta_id !== null) {
      seleccionarRuta(rutaFinal.ruta_id);
    }
  };

  const eliminar = async (ruta: RutaDiseñada) => {
    if (!window.confirm(`¿Eliminar la ruta del Camión ${ruta.camion_id}?`)) return;

    await eliminarRuta(ruta);

    if (camionId === ruta.camion_id) {
      limpiarRuta();
      setRutaEditada(undefined);
      setCamionId(null);
      setMostrarSeleccionCamion(true);
    }
  };

  const cambiarCamion = () => {
    setCamionId(null);
    setMostrarSeleccionCamion(true);
    setRutaEditada(undefined);
    limpiarRuta();
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      <div className="panel-diseñador">
        <h3>Diseñador de Rutas</h3>
        <p>{camionId ? `Camión ${camionId}` : "Seleccione un camión"}</p>
        {cargando && <p className="texto-estado">Cargando rutas...</p>}
        {errorRutas && <p className="texto-error">{errorRutas}</p>}
        {error && <p className="texto-error">{error}</p>}

        <label className="selector-rutas">
          Ver rutas
          <select
            value={rutaSeleccionadaId ?? "todas"}
            onChange={(event) => {
              if (event.target.value === "todas") {
                verTodas();
                return;
              }

              seleccionarRuta(Number(event.target.value));
            }}
          >
            <option value="todas">Todas las rutas</option>
            {rutas
              .filter((ruta) => ruta.ruta_id !== null)
              .map((ruta) => (
                <option key={ruta.ruta_id} value={ruta.ruta_id ?? ""}>
                  Camión {ruta.camion_id} - {ruta.nombre}
                </option>
              ))}
          </select>
        </label>

        <div className="acciones">
          <button onClick={deshacerUltimo} disabled={!camionId || puntos.length === 0}>
            Deshacer
          </button>
          <button onClick={limpiarRuta} disabled={!camionId || puntos.length === 0}>
            Limpiar
          </button>
          <button onClick={() => setMostrarFormulario(true)} disabled={!camionId || !puedeGuardar}>
            Finalizar Ruta
          </button>
          {rutaEditada && <button onClick={() => setMostrarFormulario(true)}>Editar formulario</button>}
          <button onClick={cambiarCamion}>Cambiar camión</button>
        </div>
      </div>

      <ResumenRutas rutas={rutas} onEditar={editar} onEliminar={eliminar} onVer={ver} />
      <MapaDiseñadorView
        puntos={puntos}
        rutasVisibles={rutasVisibles}
        rutaEditadaId={rutaEditada?.ruta_id}
        onAddPoint={agregarPunto}
        onEditPoint={editarPunto}
        puedeDibujar={camionId !== null}
      />

      {mostrarSeleccionCamion && <SeleccionCamionModal onConfirmar={seleccionarCamion} />}
      {mostrarFormulario && camionId !== null && (
        <RutaFormModal
          camionId={camionId}
          ruta={rutaEditada}
          onCancelar={() => setMostrarFormulario(false)}
          onGuardar={guardar}
        />
      )}
      {rutas.length > 0 && (
        <button
          className="boton-primario"
          style={{ position: "absolute", zIndex: 1000, left: 14, bottom: 14 }}
          onClick={() => irAMonitoreo((camionId !== null ? obtenerRutaPorCamion(camionId) : undefined) ?? rutas[0])}
        >
          Ir a Monitoreo
        </button>
      )}
    </div>
  );
}
