import { Fragment } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordenada } from "../models/geo";
import { puntosRutaACoordenadas, type RutaDiseñada } from "../models/rutaDiseñada";
import ClickParaPuntos from "./ClickParaPuntos";
import { generarGeometriaVisual } from "../services/mapaGeoService";
import {
  MAP_BOUNDS_VISCOSITY,
  MAP_INITIAL_ZOOM,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  SUCHIAPA_BOUNDS,
  SUCHIAPA_CENTER,
} from "../constants/mapa";

export default function MapaDiseñadorView({
  puntos,
  rutasVisibles,
  rutaEditadaId,
  onAddPoint,
  onEditPoint,
  puedeDibujar,
  modoDetector,
  puntosConectadosDetector,
  puntosPendientesDetector,
  candidatoDetector,
  geometriaOficial = null,
}: {
  puntos: Coordenada[];
  rutasVisibles: RutaDiseñada[];
  rutaEditadaId?: number | null;
  onAddPoint: (punto: Coordenada) => void;
  onEditPoint: (indice: number, punto: Coordenada) => void;
  puedeDibujar: boolean;
  modoDetector: boolean;
  puntosConectadosDetector: Coordenada[];
  puntosPendientesDetector: Coordenada[];
  candidatoDetector: Coordenada | null;
  /**
   * Geometria oficial por calles (Fase 9), calculada bajo demanda con
   * rutaVialService.obtenerGeometriaVial y guardada por el componente padre.
   * Si esta presente (>= 2 puntos), reemplaza la curva provisional
   * (generarGeometriaVisual) SOLO para la ruta que se esta editando en este
   * momento; el resto de rutasVisibles no se ve afectado.
   */
  geometriaOficial?: Coordenada[] | null;
}) {
  return (
    <MapContainer
      center={SUCHIAPA_CENTER}
      zoom={MAP_INITIAL_ZOOM}
      minZoom={MAP_MIN_ZOOM}
      maxZoom={MAP_MAX_ZOOM}
      maxBounds={SUCHIAPA_BOUNDS as [number, number][]}
      maxBoundsViscosity={MAP_BOUNDS_VISCOSITY}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />

      {rutasVisibles
        .filter((ruta) => ruta.ruta_id !== rutaEditadaId)
        .map((ruta) => {
          const coordenadas = puntosRutaACoordenadas(ruta.puntos);
          const color = ruta.color ?? "#2563eb";

          return (
            <Fragment key={ruta.ruta_id ?? `camion-${ruta.camion_id}`}>
              {coordenadas.length >= 2 && (
                <Polyline
                  positions={generarGeometriaVisual(coordenadas)}
                  pathOptions={{ color, weight: 4, opacity: 0.75 }}
                />
              )}

              {coordenadas.map((punto, index) => (
                <CircleMarker
                  key={`${ruta.ruta_id ?? ruta.camion_id}-${index}`}
                  center={punto}
                  radius={5}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}
                />
              ))}
            </Fragment>
          );
        })}

      {puedeDibujar && <ClickParaPuntos onAddPoint={onAddPoint} />}

      {!modoDetector && (
        <>
          {puntos.length >= 2 && (
            <Polyline
              positions={
                geometriaOficial && geometriaOficial.length >= 2 ? geometriaOficial : generarGeometriaVisual(puntos)
              }
              pathOptions={{ color: "#111827", weight: 5 }}
            />
          )}

          {puntos.map((punto, index) => (
            <Marker
              key={index}
              position={punto}
              draggable={puedeDibujar}
              eventHandlers={{
                dragend: (event) => {
                  const posicion = event.target.getLatLng();
                  onEditPoint(index, [posicion.lat, posicion.lng]);
                },
              }}
            />
          ))}
        </>
      )}

      {modoDetector && (
        <>
          {/* Conectados: peso > 0, forman la cadena real de la ruta. */}
          {puntosConectadosDetector.length >= 2 && (
            <Polyline
              positions={
                geometriaOficial && geometriaOficial.length >= 2
                  ? geometriaOficial
                  : generarGeometriaVisual(puntosConectadosDetector)
              }
              pathOptions={{ color: "#7c3aed", weight: 5 }}
            />
          )}
          {puntosConectadosDetector.map((punto, index) => (
            <CircleMarker
              key={`conectado-${index}`}
              center={punto}
              radius={6}
              pathOptions={{ color: "#7c3aed", fillColor: "#7c3aed", fillOpacity: 0.9 }}
            />
          ))}

          {/* Pendientes: peso = 0, sin vecino cercano, sin Polyline hasta que
              otra deteccion los conecte (ver PLAN_MAPA_COMPLETO.md, seccion 7). */}
          {puntosPendientesDetector.map((punto, index) => (
            <CircleMarker
              key={`pendiente-${index}`}
              center={punto}
              radius={6}
              pathOptions={{ color: "#b45309", fillColor: "#fde68a", fillOpacity: 0.85, dashArray: "4 3" }}
            />
          ))}

          {/* Candidato: recien marcado con clic, esperando "Detectar punto". */}
          {candidatoDetector && (
            <CircleMarker
              center={candidatoDetector}
              radius={8}
              pathOptions={{ color: "#0284c7", fillColor: "#7dd3fc", fillOpacity: 0.6, dashArray: "3 3" }}
            />
          )}
        </>
      )}
    </MapContainer>
  );
}
