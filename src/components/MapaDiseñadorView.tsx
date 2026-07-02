import {
  MapContainer,
  TileLayer,
  Polyline,
  useMapEvents,
  Marker,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordenada } from "../models/geo";
import { SUCHIAPA_CENTER, SUCHIAPA_BOUNDS } from "../constants/mapa";

function ClickParaPuntos({
  onAddPoint,
}: {
  onAddPoint: (p: Coordenada) => void;
}) {
  useMapEvents({
    click(e) {
      const punto: Coordenada = [e.latlng.lat, e.latlng.lng];
      onAddPoint(punto);
    },
  });

  return null;
}

export default function MapaDiseñadorView({
  puntos,
  onAddPoint,
}: {
  puntos: Coordenada[];
  onAddPoint: (punto: Coordenada) => void;
}) {
  return (
    <MapContainer
      center={SUCHIAPA_CENTER}
      zoom={14}
      minZoom={13}
      maxZoom={18}
      maxBounds={SUCHIAPA_BOUNDS as [number, number][]}
      maxBoundsViscosity={1.0}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickParaPuntos onAddPoint={onAddPoint} />

      {puntos.map((punto, index) => (
        <Marker key={index} position={punto} />
      ))}

      {puntos.length >= 2 && <Polyline positions={puntos} />}
    </MapContainer>
  );
}
