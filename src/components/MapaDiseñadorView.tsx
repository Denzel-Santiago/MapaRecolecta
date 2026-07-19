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
}: {
  puntos: Coordenada[];
  rutasVisibles: RutaDiseñada[];
  rutaEditadaId?: number | null;
  onAddPoint: (punto: Coordenada) => void;
  onEditPoint: (indice: number, punto: Coordenada) => void;
  puedeDibujar: boolean;
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
                <Polyline positions={coordenadas} pathOptions={{ color, weight: 4, opacity: 0.75 }} />
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

      {puntos.length >= 2 && <Polyline positions={puntos} pathOptions={{ color: "#111827", weight: 5 }} />}

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
    </MapContainer>
  );
}
