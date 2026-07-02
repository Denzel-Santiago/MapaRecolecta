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
      center={ruta.length > 0 ? ruta[0] : [16.6166, -93.1]}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

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
