import { useEffect, useState } from "react";
import MapaDiseñadorView from "./MapaDiseñadorView";
import SeleccionCamionModal from "./SeleccionCamionModal";
import RutaFormModal from "./RutaFormModal";
import ResumenRutas from "./ResumenRutas";
import { useRutaDiseñador } from "../hooks/useRutaDiseñador";
import { useDetectorRuta } from "../hooks/useDetectorRuta";
import { useRutaBorrador } from "../hooks/useRutaBorrador";
import type { Coordenada } from "../models/geo";
import type { DatosRutaForm, RutaDiseñada } from "../models/rutaDiseñada";
import { puntosRutaACoordenadas } from "../models/rutaDiseñada";
import { crearRutaDiseñada } from "../services/rutaService";
import { puntosRutaAConPeso } from "../services/detectorRutaService";
import { estaModoOfflineActivo } from "../services/offlineMode";
import { ajustarPuntoACalle, obtenerGeometriaVial } from "../services/rutaVialService";
import { construirPayloadSync } from "../services/rutaBorradorService";
import { sincronizarPuntosDeRuta } from "../services/puntosRecoleccionApi";
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
import "./diseñador.css";

// Fase 12 (PLAN_MAPA_COMPLETO.md): intento EXPERIMENTAL y opcional de sync
// contra un endpoint cuyo contrato no esta confirmado con backend. Apagado
// por defecto (VITE_SYNC_PUNTOS_ENABLED=false); si algun dia se activa y el
// endpoint no existe o responde distinto, el intento falla en silencio y no
// bloquea el guardado normal (que ya se completo antes de intentarlo).
const SYNC_PUNTOS_ENABLED = import.meta.env.VITE_SYNC_PUNTOS_ENABLED === "true";

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

function fechaAsignacionHoy(): string {
  return new Date().toISOString().slice(0, 10);
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
  const [modoDetector, setModoDetector] = useState(false);
  const { puntos, error, agregarPunto, deshacerUltimo, limpiarRuta, reemplazarPuntos, editarPunto, puedeGuardar } =
    useRutaDiseñador();
  const detector = useDetectorRuta();
  const borrador = useRutaBorrador();
  const [errorSyncPuntos, setErrorSyncPuntos] = useState<string | null>(null);
  const [geometriaOficial, setGeometriaOficial] = useState<Coordenada[] | null>(null);
  const [calculandoGeometria, setCalculandoGeometria] = useState(false);
  const [errorGeometriaVial, setErrorGeometriaVial] = useState<string | null>(null);
  const [fuenteGeometria, setFuenteGeometria] = useState<"osrm" | "local" | null>(null);
  const [errorAsignacion, setErrorAsignacion] = useState<string | null>(null);
  const [errorPuntos, setErrorPuntos] = useState<string | null>(null);
  const [perfilRuteo, setPerfilRuteo] = useState("driving");

  // El modo detector (ver PLAN_MAPA_COMPLETO.md, seccion 6) convive con el
  // flujo de clic libre sin reemplazarlo: ambos hooks se mantienen
  // sincronizados con la ruta seleccionada, y "modoDetector" solo decide
  // cual de los dos se muestra y se usa al guardar.
  const puntosActivos = modoDetector ? detector.puntosConectados : puntos;
  const puedeGuardarActual = modoDetector ? detector.puedeGuardar : puedeGuardar;
  const errorActivo = modoDetector ? detector.error : error;
  const puedeFinalizarRuta = puedeGuardarActual && geometriaOficial !== null && geometriaOficial.length >= 2;
  const totalPuntosActivos = puntosActivos.length;
  const guiaActual =
    camionId === null
      ? "Selecciona un camion para empezar."
      : totalPuntosActivos === 0
        ? "Haz clic sobre una calle para agregar el primer punto."
        : totalPuntosActivos === 1
          ? "Agrega al menos un punto mas para formar una ruta."
          : !geometriaOficial
            ? "Calcula el trazado por calles antes de finalizar."
            : "Ruta lista para finalizar o publicar.";
  const descripcionPerfil =
    perfilRuteo === "driving"
      ? "Respeta sentidos de calle. Puede generar vueltas largas."
      : "Prioriza cobertura corta para comparar recorridos.";

  // Fase 7 (seccion 5.1 y 6.6 del plan): el borrador envuelve la salida de
  // cualquiera de los dos flujos anteriores sin tocar su logica interna.
  // Todavia no cambia el guardado real (eso sigue siendo rutasApi mas abajo,
  // como respaldo); por ahora solo mantiene el estado de cambios al dia.
  useEffect(() => {
    borrador.sincronizarPuntos(puntosActivos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puntosActivos, perfilRuteo]);

  // Fase 9: la geometria oficial calculada (si la hay) queda obsoleta en
  // cuanto los puntos de control cambian; se limpia y hay que volver a
  // pedirla con el boton "Calcular geometria oficial".
  // Fase 10: si la ruta ya estaba PUBLICADA, esa geometria ya no es la que
  // se publico, asi que la publicacion tambien queda invalida (vuelve a
  // BORRADOR) hasta que se recalcule y se publique de nuevo.
  useEffect(() => {
    setGeometriaOficial(null);
    setFuenteGeometria(null);
    setErrorGeometriaVial(null);
    if (borrador.borrador.estadoPublicacion === "PUBLICADA") {
      borrador.despublicar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puntosActivos]);

  const calcularGeometriaOficial = async () => {
    setCalculandoGeometria(true);
    setErrorGeometriaVial(null);

    try {
      const resultado = await obtenerGeometriaVial(puntosActivos, undefined, perfilRuteo);
      setGeometriaOficial(resultado.puntos);
      setFuenteGeometria(resultado.origen);
    } catch (err) {
      setGeometriaOficial(null);
      setFuenteGeometria(null);
      setErrorGeometriaVial(
        err instanceof Error ? err.message : "No se pudo calcular la geometria oficial."
      );
    } finally {
      setCalculandoGeometria(false);
    }
  };

  const agregarPuntoVial = async (punto: Coordenada) => {
    try {
      const puntoSobreCalle = await ajustarPuntoACalle(punto, undefined, perfilRuteo);
      if (modoDetector) {
        detector.marcarCandidato(puntoSobreCalle.coordenada);
      } else {
        agregarPunto(puntoSobreCalle.coordenada);
      }
      setErrorGeometriaVial(null);
    } catch (err) {
      setErrorGeometriaVial(err instanceof Error ? err.message : "El punto no esta sobre una calle valida.");
    }
  };

  const editarPuntoVial = async (indice: number, punto: Coordenada) => {
    try {
      const puntoSobreCalle = await ajustarPuntoACalle(punto, undefined, perfilRuteo);
      editarPunto(indice, puntoSobreCalle.coordenada);
      setErrorGeometriaVial(null);
    } catch (err) {
      setErrorGeometriaVial(err instanceof Error ? err.message : "El punto no esta sobre una calle valida.");
    }
  };

  const persistirAsignacionCamion = async (rutaId: number, camionIdAsignado: number): Promise<string | null> => {
    if (estaModoOfflineActivo()) {
      return null;
    }

    try {
      const fecha = fechaAsignacionHoy();
      const asignacionActual = await obtenerAsignacionActivaPorRuta(rutaId);

      if (asignacionActual?.ruta_camion_id) {
        await actualizarAsignacion(asignacionActual.ruta_camion_id, rutaId, camionIdAsignado, fecha);
      } else {
        await crearAsignacion(rutaId, camionIdAsignado, fecha);
      }

      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "No se pudo asignar el camion a la ruta.";
    }
  };

  const seleccionarCamion = (id: number) => {
    const rutaExistente = obtenerRutaPorCamion(id);

    setCamionId(id);
    setMostrarSeleccionCamion(false);
    setRutaEditada(rutaExistente);
    reemplazarPuntos(rutaExistente ? puntosRutaACoordenadas(rutaExistente.puntos) : []);
    detector.reemplazarConectados(rutaExistente ? puntosRutaAConPeso(rutaExistente.puntos) : []);
    borrador.cargarDesdeRuta(rutaExistente);
    setErrorSyncPuntos(null);
    setErrorAsignacion(null);
    setErrorPuntos(null);
    setGeometriaOficial(null);
    setFuenteGeometria(null);

    if (rutaExistente?.ruta_id !== null && rutaExistente?.ruta_id !== undefined) {
      seleccionarRuta(rutaExistente.ruta_id);
    }
  };

  const editar = (ruta: RutaDiseñada) => {
    setCamionId(ruta.camion_id);
    setRutaEditada(ruta);
    reemplazarPuntos(puntosRutaACoordenadas(ruta.puntos));
    detector.reemplazarConectados(puntosRutaAConPeso(ruta.puntos));
    borrador.cargarDesdeRuta(ruta);
    setErrorSyncPuntos(null);
    setErrorAsignacion(null);
    setErrorPuntos(null);
    setGeometriaOficial(null);
    setFuenteGeometria(null);

    if (esRutaPersistida(ruta)) {
      seleccionarRuta(ruta.ruta_id);
    }
  };

  const ver = (ruta: RutaDiseñada) => {
    reemplazarPuntos([]);
    detector.limpiarDetector();
    borrador.limpiarBorrador();
    setErrorSyncPuntos(null);
    setErrorAsignacion(null);
    setErrorPuntos(null);
    setGeometriaOficial(null);
    setFuenteGeometria(null);
    setRutaEditada(undefined);
    setCamionId(null);
    setMostrarSeleccionCamion(false);

    if (ruta.ruta_id !== null) {
      seleccionarRuta(ruta.ruta_id);
    }
  };

  const guardar = async (datos: DatosRutaForm) => {
    if (camionId === null) return;

    if (!geometriaOficial || geometriaOficial.length < 2) {
      setErrorGeometriaVial("Calcula la geometria oficial por calles antes de finalizar la ruta.");
      return;
    }

    const existente = obtenerRutaPorCamion(camionId);
    if (
      existente &&
      !esMismaRuta(existente, rutaEditada) &&
      !window.confirm(`El Camión ${camionId} ya tiene una ruta asignada.\n\n¿Desea reemplazarla?`)
    ) {
      return;
    }

    const rutaBase = crearRutaDiseñada(camionId, datos, puntosActivos, rutaEditada?.ruta_id ?? null);
    const modoBorrador = esRutaPersistida(rutaEditada);
    const rutaLocal = {
      ...rutaBase,
      color: rutaEditada?.color ?? rutaBase.color,
      geometria: geometriaOficial,
    };

    // Se arma el payload de sync ANTES de guardar (con el ruta_id que el
    // borrador ya tenia): solo aplica para rutas que ya existian, porque una
    // ruta recien creada todavia no tiene puntos que "sincronizar" aparte,
    // el guardado normal de abajo ya los crea de una vez.
    const payloadSyncPendiente =
      SYNC_PUNTOS_ENABLED && borrador.borrador.ruta_id !== null && borrador.tieneCambiosPendientes
        ? construirPayloadSync(borrador.borrador)
        : null;

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
      geometria: geometriaOficial,
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
        const puntosPersistidos = await reemplazarPuntosDeRuta(rutaFinal.ruta_id, rutaFinal.puntos);

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
    // Fase 12: el guardado real (arriba) ya es la fuente de verdad; el
    // borrador se vuelve a basar en lo que quedo guardado, para que el
    // indicador de "cambios sin sincronizar" no quede encendido para siempre
    // despues de un guardado exitoso.
    borrador.cargarDesdeRuta(rutaFinal);
    setErrorSyncPuntos(null);

    if (rutaFinal.ruta_id !== null) {
      seleccionarRuta(rutaFinal.ruta_id);
      // A partir de aqui la ruta ya esta persistida (tenga o no
      // ruta_id antes de este guardado): se reinicia el borrador desde
      // el estado final confirmado por backend, para que la siguiente
      // edicion parta de datos frescos y con los punto_id reales.
      borrador.cargarDesdeRuta(rutaFinal);
    }

    if (payloadSyncPendiente) {
      try {
        await sincronizarPuntosDeRuta(rutaFinal.ruta_id ?? payloadSyncPendiente.ruta_id, payloadSyncPendiente);
      } catch (err) {
        // No bloqueante: el guardado normal de arriba ya se completo. Esto
        // es solo un intento experimental adicional (ver VITE_SYNC_PUNTOS_ENABLED).
        setErrorSyncPuntos(
          "El guardado se completo. El intento experimental de sync contra backend fallo: " +
            (err instanceof Error ? err.message : "error desconocido")
        );
      }
    }
  };

  const eliminar = async (ruta: RutaDiseñada) => {
    if (!window.confirm(`¿Eliminar la ruta del Camión ${ruta.camion_id ?? "sin asignar"}?`)) return;

    await eliminarRuta(ruta);

    if (camionId === ruta.camion_id) {
      limpiarRuta();
      detector.limpiarDetector();
      borrador.limpiarBorrador();
      setErrorSyncPuntos(null);
      setErrorAsignacion(null);
      setErrorPuntos(null);
      setGeometriaOficial(null);
      setFuenteGeometria(null);
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
    detector.limpiarDetector();
    borrador.limpiarBorrador();
    setErrorSyncPuntos(null);
    setErrorAsignacion(null);
    setErrorPuntos(null);
    setGeometriaOficial(null);
    setFuenteGeometria(null);
  };

  const alternarModoDetector = () => {
    setModoDetector((actual) => !actual);
  };

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      <div className="panel-diseñador">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Recolecta</p>
            <h3>Diseñador</h3>
          </div>
          <span className={camionId ? "estado-chip activo" : "estado-chip"}>{camionId ? `Camion ${camionId}` : "Sin camion"}</span>
        </div>

        <div className="guia-uso" role="status">
          <strong>Siguiente paso</strong>
          <span>{guiaActual}</span>
        </div>

        <div className="metricas-ruta">
          <span>{totalPuntosActivos} puntos</span>
          <span>{geometriaOficial ? "Trazado listo" : "Sin trazado"}</span>
        </div>

        {cargando && <p className="texto-estado">Cargando rutas...</p>}
        {errorRutas && <p className="texto-error">{errorRutas}</p>}
        {errorActivo && <p className="texto-error">{errorActivo}</p>}
        {modoDetector && (
          <p className="texto-estado">
            Modo detector: marca un punto y confirmalo para conectarlo.
            {detector.pendientes.length > 0 &&
              ` ${detector.pendientes.length} punto(s) sin conectar todavia.`}
          </p>
        )}
        {camionId !== null && borrador.tieneCambiosPendientes && (
          <p className="texto-estado">Hay cambios sin sincronizar contra backend (borrador).</p>
        )}
        {errorSyncPuntos && <p className="texto-error">{errorSyncPuntos}</p>}
        {errorAsignacion && <p className="texto-error">Ruta guardada, pero fallo la asignacion: {errorAsignacion}</p>}
        {errorPuntos && <p className="texto-error">{errorPuntos}</p>}
        {errorGeometriaVial && <p className="texto-error">{errorGeometriaVial}</p>}
        {geometriaOficial && (
          <p className="texto-estado">
            Mostrando geometria oficial por calles
            {fuenteGeometria === "local" ? " (modo local de prueba)." : "."}
          </p>
        )}
        {camionId !== null && (
          <p className="texto-estado">
            Estado de publicacion: {borrador.borrador.estadoPublicacion}
            {borrador.borrador.estadoPublicacion === "PUBLICADA" &&
              " (solo en esta sesion; backend todavia no confirma si guarda este estado)."}
            {borrador.borrador.estadoPublicacion === "ERROR" &&
              " (no se pudo publicar: calcula la geometria oficial primero)."}
          </p>
        )}

        <label className="selector-rutas">
          Rutas visibles
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
          <p className="grupo-acciones-titulo">Edicion</p>
          <button onClick={alternarModoDetector} disabled={!camionId} title="Cambia entre agregar puntos directo o confirmar cada punto antes de conectarlo.">
            {modoDetector ? "Detector activo" : "Usar detector"}
          </button>
          {modoDetector ? (
            <>
              <button onClick={detector.detectarPunto} disabled={!camionId || !detector.candidato}>
                Confirmar punto
              </button>
              <button onClick={detector.cancelarCandidato} disabled={!detector.candidato}>
                Cancelar
              </button>
              <button onClick={detector.limpiarDetector} disabled={!camionId || detector.conectados.length === 0}>
                Limpiar
              </button>
            </>
          ) : (
            <>
              <button onClick={deshacerUltimo} disabled={!camionId || puntos.length === 0}>
                Deshacer
              </button>
              <button onClick={limpiarRuta} disabled={!camionId || puntos.length === 0}>
                Limpiar
              </button>
            </>
          )}
          <label className="selector-rutas">
            Tipo de trazado
            <select
              value={perfilRuteo}
              onChange={(event) => setPerfilRuteo(event.target.value)}
              disabled={!camionId || calculandoGeometria}
            >
              <option value="driving">Vehiculo</option>
              <option value="foot">Cobertura corta</option>
            </select>
            <span className="texto-ayuda">{descripcionPerfil}</span>
          </label>
          <p className="grupo-acciones-titulo">Ruta</p>
          <button
            onClick={calcularGeometriaOficial}
            disabled={!camionId || puntosActivos.length < 2 || calculandoGeometria}
            className="boton-primario"
          >
            {calculandoGeometria ? "Calculando..." : "Calcular trazado"}
          </button>
          <button
            onClick={() => setMostrarFormulario(true)}
            disabled={!camionId || !puedeFinalizarRuta}
            title={!puedeFinalizarRuta ? "Calcula la geometria oficial por calles antes de finalizar" : undefined}
          >
            Guardar ruta
          </button>
          {borrador.borrador.estadoPublicacion === "PUBLICADA" ? (
            <button onClick={borrador.despublicar}>Despublicar</button>
          ) : (
            <button
              onClick={() => borrador.publicar(geometriaOficial)}
              disabled={
                !camionId ||
                rutaEditada?.ruta_id == null ||
                !borrador.puedePublicarse(geometriaOficial)
              }
              title={
                rutaEditada?.ruta_id == null
                  ? "Guarda la ruta antes de publicarla"
                  : !borrador.puedePublicarse(geometriaOficial)
                    ? "Calcula la geometria oficial antes de publicar"
                    : undefined
              }
            >
              Publicar
            </button>
          )}
          {rutaEditada && <button onClick={() => setMostrarFormulario(true)}>Editar datos</button>}
          <button onClick={cambiarCamion}>Cambiar camion</button>
        </div>
      </div>

      <ResumenRutas rutas={rutas} onEditar={editar} onEliminar={eliminar} onVer={ver} />
      <MapaDiseñadorView
        puntos={puntos}
        rutasVisibles={rutasVisibles}
        rutaEditadaId={rutaEditada?.ruta_id}
        onAddPoint={agregarPuntoVial}
        onEditPoint={editarPuntoVial}
        puedeDibujar={camionId !== null}
        modoDetector={modoDetector}
        puntosConectadosDetector={detector.puntosConectados}
        puntosPendientesDetector={detector.puntosPendientes}
        geometriaOficial={geometriaOficial}
        candidatoDetector={detector.candidato}
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
