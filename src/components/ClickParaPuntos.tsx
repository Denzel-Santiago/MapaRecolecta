import { useMapEvents } from "react-leaflet";
import type { Coordenada } from "../models/geo";

export default function ClickParaPuntos({
  onAddPoint,
}: {
  onAddPoint: (p: Coordenada) => void;
}) {
  useMapEvents({
    click(e) {
      onAddPoint([e.latlng.lat, e.latlng.lng]);
    },
  });

  return null;
}
