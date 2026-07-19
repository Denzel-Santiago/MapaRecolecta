import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordenada } from "../models/geo";
import { obtenerIconoCamion } from "../utils/IconosCamion";
import type { EstadoCamion } from "../data/DatosFalsos";
import { MAP_INITIAL_ZOOM, OSM_ATTRIBUTION, OSM_TILE_URL, SUCHIAPA_CENTER } from "../constants/mapa";

const CAMION_ESTADO_PREDETERMINADO: EstadoCamion = "activo";

export default function MapaMonitoreoView({
  ruta,
  posicionCamion,
  rutaRecorrida,
}: {
  ruta: Coordenada[];
  posicionCamion: Coordenada | null;
  rutaRecorrida: Coordenada[];
}) {
  return (
    <MapContainer
      center={ruta.length > 0 ? ruta[0] : SUCHIAPA_CENTER}
      zoom={MAP_INITIAL_ZOOM}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer attribution={OSM_ATTRIBUTION} url={OSM_TILE_URL} />

      {ruta.map((punto, index) => {
        const recorrido = index < rutaRecorrida.length;

        return (
          <CircleMarker
            key={index}
            center={punto}
            radius={6}
            pathOptions={{
              color: recorrido ? "#66bb6a" : "gray",
              fillColor: recorrido ? "#66bb6a" : "gray",
              fillOpacity: 1,
            }}
          />
        );
      })}

      {ruta.length >= 2 && (
        <Polyline positions={ruta} pathOptions={{ color: "gray", weight: 4 }} />
      )}

      {rutaRecorrida.length >= 2 && (
        <Polyline positions={rutaRecorrida} pathOptions={{ color: "#66bb6a", weight: 6 }} />
      )}

      {posicionCamion && (
        <Marker
          position={posicionCamion}
          icon={obtenerIconoCamion(CAMION_ESTADO_PREDETERMINADO)}
        />
      )}
    </MapContainer>
  );
}
