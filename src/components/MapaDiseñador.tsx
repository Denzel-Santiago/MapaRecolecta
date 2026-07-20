import { useState } from "react";
import MapaDiseñadorView from "./MapaDiseñadorView";
import SeleccionCamionModal from "./SeleccionCamionModal";
import RutaFormModal from "./RutaFormModal";
import ResumenRutas from "./ResumenRutas";
import { useRutaDiseñador } from "../hooks/useRutaDiseñador";
import { useRutaBorrador } from "../hooks/useRutaBorrador";
import type { DatosRutaForm, RutaDiseñada } from "../models/rutaDiseñada";
import { puntosRutaACoordenadas } from "../models/rutaDiseñada";
import { borradorAPuntosRuta } from "../models/rutaBorrador";
import { crearRutaDiseñada } from "../services/rutaService";
import {
  actualizarRuta as actualizarRutaApi,
  backendToRutaDiseñada,
  guardarRuta as guardarRutaApi,
} from "../services/rutasApi";
import {
  actualizarAsignacion,
  crearAsignacion,
  obtenerAsignacionActivaPorRuta,
} from "../services/rutaCamionApi";
import { reemplazarPuntosDeRuta } from "../services/puntosRecoleccionApi";
import { guardarPuntosBorrador } from "../services/rutaBorradorService";
import "./diseñador.css";

function fechaHoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// El backend real no guarda camion_id dentro de Ruta: la asignacion se
// persiste aparte en /api/ruta-camion (ver PLAN_DE_SEGUIMIENTO.md seccion
// 14.2). Si esto falla, la ruta ya quedo guardada; se reporta el error
// pero no se revierte el guardado de la ruta.
async function persistirAsignacionCamion(rutaId: number, camionId: number): Promise<string | null> {
  try {
    const asignacionActual = await obtenerAsignacionActivaPorRuta(rutaId);

    if (!asignacionActual) {
      await crearAsignacion(rutaId, camionId, fechaHoyISO());
    } else if (asignacionActual.camion_id !== camionId && asignacionActual.ruta_camion_id) {
      await actualizarAsignacion(asignacionActual.ruta_camion_id, rutaId, camionId, fechaHoyISO());
    }

    return null;
  } catch (err) {
    return err instanceof Error
      ? err.message
      : "No se pudo guardar la asignacion de camion para esta ruta.";
  }
}

function esMismaRuta(a: RutaDiseñada, b?: RutaDiseñada): boolean {
  if (!b) return false;
  if (a.ruta_id !== null && b.ruta_id !== null) return a.ruta_id === b.ruta_id;
  return a.camion_id === b.camion_id;
}

// Una ruta "en modo borrador" es una ruta ya persistida (con ruta_id
// real): ahi se usa el modelo de borrador (PLAN_ADAPTACION_ADMIN.md Fase
// 1-3) para rastrear altas/bajas/movimientos punto por punto. Una ruta
// que todavia no se guardo nunca (ruta_id === null) sigue el flujo de
// dibujo libre de siempre (useRutaDiseñador), sin cambios.
function esRutaPersistida(ruta?: RutaDiseñada): ruta is RutaDiseñada & { ruta_id: number } {
  return !!ruta && ruta.ruta_id !== null;
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
  const [errorAsignacion, setErrorAsignacion] = useState<string | null>(null);
  const [errorPuntos, setErrorPuntos] = useState<string | null>(null);

  // Dibujo libre: ruta nueva, todavia sin ruta_id. Flujo sin cambios.
  const dibujoLibre = useRutaDiseñador();
  // Modo borrador: ruta existente, con ruta_id real. Fase 3 del plan.
  const rutaBorrador = useRutaBorrador();

  const modoBorrador = esRutaPersistida(rutaEditada);

  const puntos = modoBorrador ? rutaBorrador.puntos : dibujoLibre.puntos;
  const error = modoBorrador ? rutaBorrador.error : dibujoLibre.error;
  const puedeGuardar = modoBorrador ? rutaBorrador.puedeGuardar : dibujoLibre.puedeGuardar;
  const agregarPunto = modoBorrador ? rutaBorrador.agregarPunto : dibujoLibre.agregarPunto;
  const editarPunto = modoBorrador ? rutaBorrador.editarPunto : dibujoLibre.editarPunto;
  const deshacerUltimo = modoBorrador ? rutaBorrador.deshacerUltimo : dibujoLibre.deshacerUltimo;

  // "Limpiar" solo descarta cambios de la sesion de edicion actual: en
  // modo borrador vuelve a partir de la ruta ya guardada (no la borra ni
  // la deja vacia); en dibujo libre, vacia los puntos temporales de
  // siempre (REGLAS_PARA_EL_AGENTE.md seccion 8).
  const limpiarRuta = () => {
    if (modoBorrador && rutaEditada) {
      rutaBorrador.iniciarDesdeRuta(rutaEditada);
    } else {
      dibujoLibre.limpiarRuta();
    }
  };

  const seleccionarCamion = (id: number) => {
    const rutaExistente = obtenerRutaPorCamion(id);

    setCamionId(id);
    setMostrarSeleccionCamion(false);
    setRutaEditada(rutaExistente);

    if (esRutaPersistida(rutaExistente)) {
      rutaBorrador.iniciarDesdeRuta(rutaExistente);
      dibujoLibre.reemplazarPuntos([]);
    } else {
      rutaBorrador.limpiar();
      dibujoLibre.reemplazarPuntos([]);
    }

    if (rutaExistente?.ruta_id !== null && rutaExistente?.ruta_id !== undefined) {
      seleccionarRuta(rutaExistente.ruta_id);
    }
  };

  const editar = (ruta: RutaDiseñada) => {
    setCamionId(ruta.camion_id);
    setRutaEditada(ruta);

    if (esRutaPersistida(ruta)) {
      rutaBorrador.iniciarDesdeRuta(ruta);
      dibujoLibre.reemplazarPuntos([]);
      seleccionarRuta(ruta.ruta_id);
    } else {
      rutaBorrador.limpiar();
      dibujoLibre.reemplazarPuntos(puntosRutaACoordenadas(ruta.puntos));
    }
  };

  const ver = (ruta: RutaDiseñada) => {
    dibujoLibre.reemplazarPuntos([]);
    rutaBorrador.limpiar();
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
    // En modo borrador, se usan los puntos del borrador (con punto_id
    // real preservado para los que ya existian) en vez de re-aplanar las
    // coordenadas desde cero, que perderia esa identidad.
    const puntosLocales =
      modoBorrador && rutaBorrador.borrador ? borradorAPuntosRuta(rutaBorrador.borrador) : rutaBase.puntos;

    const rutaLocal = {
      ...rutaBase,
      puntos: puntosLocales,
      color: rutaEditada?.color ?? rutaBase.color,
    };

    const rutaGuardada =
      rutaLocal.ruta_id !== null
        ? await actualizarRutaApi(rutaLocal)
        : backendToRutaDiseñada((await guardarRutaApi(rutaLocal)).data);

    let rutaFinal: RutaDiseñada = {
      ...rutaLocal,
      ...rutaGuardada,
      // json_ruta no trae punto_id: aceptar rutaGuardada.puntos aqui en
      // modo borrador perderia la identidad que acabamos de preservar.
      puntos: modoBorrador
        ? rutaLocal.puntos
        : rutaGuardada.puntos.length > 0
          ? rutaGuardada.puntos
          : rutaLocal.puntos,
      color: rutaGuardada.color ?? rutaLocal.color,
      camion_id: camionId,
      visible: true,
    };

    setErrorAsignacion(null);
    if (rutaFinal.ruta_id !== null) {
      const errorDeAsignacion = await persistirAsignacionCamion(rutaFinal.ruta_id, camionId);
      setErrorAsignacion(errorDeAsignacion);
    }

    // Persistir los puntos en api/puntos-recoleccion (PLAN_DE_SEGUIMIENTO.md
    // seccion 4.5 y 14.3). En modo borrador se usa el guardado dirigido
    // por estado (crear solo lo nuevo, eliminar solo lo marcado); en
    // dibujo libre (ruta nueva) se usa el reemplazo completo, que es lo
    // correcto cuando no hay nada persistido todavia que preservar.
    setErrorPuntos(null);
    if (rutaFinal.ruta_id !== null) {
      try {
        const puntosPersistidos =
          modoBorrador && rutaBorrador.borrador
            ? await guardarPuntosBorrador({ ...rutaBorrador.borrador, ruta_id: rutaFinal.ruta_id })
            : await reemplazarPuntosDeRuta(rutaFinal.ruta_id, rutaFinal.puntos);

        if (puntosPersistidos.length > 0) {
          rutaFinal = { ...rutaFinal, puntos: puntosPersistidos };
        }
      } catch (err) {
        setErrorPuntos(
          err instanceof Error ? err.message : "No se pudieron guardar los puntos de la ruta en el backend."
        );
      }
    }

    guardarRuta(rutaFinal);
    setMostrarFormulario(false);
    setRutaEditada(rutaFinal);

    if (rutaFinal.ruta_id !== null) {
      seleccionarRuta(rutaFinal.ruta_id);
      // A partir de aqui la ruta ya esta persistida (tenga o no
      // ruta_id antes de este guardado): se reinicia el borrador desde
      // el estado final confirmado por backend, para que la siguiente
      // edicion parta de datos frescos y con los punto_id reales.
      rutaBorrador.iniciarDesdeRuta(rutaFinal);
    }
  };

  const eliminar = async (ruta: RutaDiseñada) => {
    if (!window.confirm(`¿Eliminar la ruta del Camión ${ruta.camion_id ?? "sin asignar"}?`)) return;

    await eliminarRuta(ruta);

    if (camionId === ruta.camion_id) {
      dibujoLibre.limpiarRuta();
      rutaBorrador.limpiar();
      setRutaEditada(undefined);
      setCamionId(null);
      setMostrarSeleccionCamion(true);
    }
  };

  const cambiarCamion = () => {
    setCamionId(null);
    setMostrarSeleccionCamion(true);
    setRutaEditada(undefined);
    dibujoLibre.limpiarRuta();
    rutaBorrador.limpiar();
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      <div className="panel-diseñador">
        <h3>Diseñador de Rutas</h3>
        <p>{camionId ? `Camión ${camionId}` : "Seleccione un camión"}</p>
        {cargando && <p className="texto-estado">Cargando rutas...</p>}
        {errorRutas && <p className="texto-error">{errorRutas}</p>}
        {error && <p className="texto-error">{error}</p>}
        {errorAsignacion && <p className="texto-error">{errorAsignacion}</p>}
        {errorPuntos && <p className="texto-error">{errorPuntos}</p>}

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
                  Camión {ruta.camion_id ?? "?"} - {ruta.nombre}
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
