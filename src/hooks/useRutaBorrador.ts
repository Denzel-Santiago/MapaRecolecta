import { useCallback, useRef, useState } from "react";
import type { Coordenada } from "../models/geo";
import type { RutaBorrador } from "../models/rutaBorrador";
import { rutaDiseñadaABorrador } from "../models/rutaBorrador";
import type { RutaDiseñada } from "../models/rutaDiseñada";
import {
  agregarPuntoBorrador,
  calcularGeometriaProvisional,
  eliminarPuntoBorrador,
  moverPuntoBorrador,
} from "../services/rutaBorradorService";
import { MIN_ROUTE_POINTS } from "../constants/mapa";

/**
 * Hook para editar en modo borrador una ruta YA GUARDADA en backend
 * (PLAN_ADAPTACION_ADMIN.md Fase 3).
 *
 * Solo aplica a rutas con `ruta_id` real: el modelo de borrador (ver
 * models/rutaBorrador.ts) existe para rastrear cambios sobre puntos que
 * ya estan persistidos. Para dibujar una ruta nueva que todavia no tiene
 * ruta_id, se sigue usando useRutaDiseñador tal cual (fallback explicito,
 * PLAN_ADAPTACION_ADMIN.md seccion 4, "Principio de compatibilidad").
 *
 * Expone una superficie de API compatible con useRutaDiseñador (puntos,
 * error, agregarPunto, editarPunto, deshacerUltimo, puedeGuardar) para
 * que MapaDiseñadorView -que solo conoce Coordenada[]- no tenga que
 * cambiar.
 */
export function useRutaBorrador() {
  const [borrador, setBorrador] = useState<RutaBorrador | null>(null);
  // IDs (temporales o reales) agregados durante la sesion de edicion
  // actual, en orden. Solo sirve para que "Deshacer" sepa cual fue el
  // ultimo punto agregado; no se persiste ni se envia a backend.
  const idsAgregadosEnSesion = useRef<Array<string | number>>([]);

  const iniciarDesdeRuta = useCallback((ruta: RutaDiseñada) => {
    idsAgregadosEnSesion.current = [];
    setBorrador(rutaDiseñadaABorrador(ruta));
  }, []);

  const limpiar = useCallback(() => {
    idsAgregadosEnSesion.current = [];
    setBorrador(null);
  }, []);

  const agregarPunto = useCallback((coordenada: Coordenada) => {
    let agregado = false;

    setBorrador((actual) => {
      if (!actual) {
        return actual;
      }

      const cantidadAntes = actual.puntos.length;
      const siguiente = agregarPuntoBorrador(actual, coordenada);
      agregado = siguiente.puntos.length > cantidadAntes;

      if (agregado) {
        const puntoNuevo = siguiente.puntos[siguiente.puntos.length - 1];
        idsAgregadosEnSesion.current.push(puntoNuevo.punto_id);
      }

      return siguiente;
    });

    return agregado;
  }, []);

  const editarPunto = useCallback((indice: number, coordenada: Coordenada) => {
    setBorrador((actual) => {
      if (!actual) {
        return actual;
      }

      const vivosOrdenados = [...actual.puntos]
        .filter((punto) => punto.estado !== "eliminado")
        .sort((a, b) => a.orden - b.orden);

      const punto = vivosOrdenados[indice];
      if (!punto) {
        return actual;
      }

      return moverPuntoBorrador(actual, punto.punto_id, coordenada);
    });
  }, []);

  // "Deshacer" solo revierte el ultimo punto agregado en esta sesion de
  // edicion (igual que el flujo actual, que nunca deshace puntos ya
  // guardados de sesiones anteriores). Si el ultimo punto agregado tenia
  // id real (caso raro: solo pasaria si se agrego y no era temporal, lo
  // cual no ocurre hoy), tambien se registra su eliminacion.
  const deshacerUltimo = useCallback(() => {
    const ultimoId = idsAgregadosEnSesion.current.pop();
    if (ultimoId === undefined) {
      return;
    }

    setBorrador((actual) => (actual ? eliminarPuntoBorrador(actual, ultimoId) : actual));
  }, []);

  const puntosVivosOrdenados = borrador
    ? [...borrador.puntos].filter((punto) => punto.estado !== "eliminado").sort((a, b) => a.orden - b.orden)
    : [];

  const puntos: Coordenada[] = borrador ? calcularGeometriaProvisional(borrador.puntos) : [];
  const error = borrador?.errores[0] ?? null;
  const puedeGuardar = puntosVivosOrdenados.length >= MIN_ROUTE_POINTS;

  return {
    borrador,
    puntos,
    error,
    puedeGuardar,
    iniciarDesdeRuta,
    limpiar,
    agregarPunto,
    editarPunto,
    deshacerUltimo,
  };
}
