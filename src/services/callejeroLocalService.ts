import { DISTANCIA_MAXIMA_CALLE_METROS } from "../constants/mapa";
import type { Coordenada } from "../models/geo";
import { calcularDistanciaMetros, estaDentroDeSuchiapa } from "./mapaGeoService";

type TipoSegmento = "horizontal" | "vertical";

interface SegmentoCalle {
  id: string;
  nombre: string;
  tipo: TipoSegmento;
  desde: Coordenada;
  hasta: Coordenada;
}

export interface PuntoSobreCalle {
  coordenada: Coordenada;
  distanciaMetros: number;
  calleId: string;
  nombreCalle: string;
  tipo: TipoSegmento;
}

export interface ResultadoAjusteCalle {
  valido: boolean;
  punto?: PuntoSobreCalle;
  mensaje?: string;
}

// Red minima para que el mapa pueda probar restricciones y rutas sin internet.
// No pretende reemplazar el mapa real de Suchiapa: es una base local que debe
// crecer con las esquinas/calles confirmadas del proyecto.
const CALLES_LOCALES: SegmentoCalle[] = [
  { id: "h-16-6145", nombre: "Calle local 1", tipo: "horizontal", desde: [16.6145, -93.106], hasta: [16.6145, -93.094] },
  { id: "h-16-6160", nombre: "Calle local 2", tipo: "horizontal", desde: [16.616, -93.106], hasta: [16.616, -93.094] },
  { id: "h-16-6175", nombre: "Calle local 3", tipo: "horizontal", desde: [16.6175, -93.106], hasta: [16.6175, -93.094] },
  { id: "h-16-6190", nombre: "Calle local 4", tipo: "horizontal", desde: [16.619, -93.106], hasta: [16.619, -93.094] },
  { id: "h-16-6205", nombre: "Calle local 5", tipo: "horizontal", desde: [16.6205, -93.106], hasta: [16.6205, -93.094] },
  { id: "h-16-6220", nombre: "Calle local 6", tipo: "horizontal", desde: [16.622, -93.106], hasta: [16.622, -93.094] },
  { id: "v-93-1045", nombre: "Avenida local 1", tipo: "vertical", desde: [16.6135, -93.1045], hasta: [16.623, -93.1045] },
  { id: "v-93-1030", nombre: "Avenida local 2", tipo: "vertical", desde: [16.6135, -93.103], hasta: [16.623, -93.103] },
  { id: "v-93-1015", nombre: "Avenida local 3", tipo: "vertical", desde: [16.6135, -93.1015], hasta: [16.623, -93.1015] },
  { id: "v-93-1000", nombre: "Avenida local 4", tipo: "vertical", desde: [16.6135, -93.1], hasta: [16.623, -93.1] },
  { id: "v-93-0985", nombre: "Avenida local 5", tipo: "vertical", desde: [16.6135, -93.0985], hasta: [16.623, -93.0985] },
  { id: "v-93-0970", nombre: "Avenida local 6", tipo: "vertical", desde: [16.6135, -93.097], hasta: [16.623, -93.097] },
];

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo);
}

function proyectarEnSegmento(punto: Coordenada, segmento: SegmentoCalle): Coordenada {
  if (segmento.tipo === "horizontal") {
    const lonMin = Math.min(segmento.desde[1], segmento.hasta[1]);
    const lonMax = Math.max(segmento.desde[1], segmento.hasta[1]);
    return [segmento.desde[0], limitar(punto[1], lonMin, lonMax)];
  }

  const latMin = Math.min(segmento.desde[0], segmento.hasta[0]);
  const latMax = Math.max(segmento.desde[0], segmento.hasta[0]);
  return [limitar(punto[0], latMin, latMax), segmento.desde[1]];
}

export function ajustarPuntoACalleLocal(punto: Coordenada): ResultadoAjusteCalle {
  if (!estaDentroDeSuchiapa(punto)) {
    return { valido: false, mensaje: "El punto esta fuera de los limites permitidos de Suchiapa." };
  }

  const mejor = CALLES_LOCALES.reduce<PuntoSobreCalle | null>((actual, segmento) => {
    const coordenada = proyectarEnSegmento(punto, segmento);
    const distanciaMetros = calcularDistanciaMetros(punto, coordenada);

    if (actual && actual.distanciaMetros <= distanciaMetros) return actual;

    return {
      coordenada,
      distanciaMetros,
      calleId: segmento.id,
      nombreCalle: segmento.nombre,
      tipo: segmento.tipo,
    };
  }, null);

  if (!mejor || mejor.distanciaMetros > DISTANCIA_MAXIMA_CALLE_METROS) {
    return {
      valido: false,
      mensaje: `Marca el punto sobre una calle valida. Distancia maxima permitida: ${DISTANCIA_MAXIMA_CALLE_METROS} m.`,
    };
  }

  return { valido: true, punto: mejor };
}

function puntoIntermedioPorCalles(origen: PuntoSobreCalle, destino: PuntoSobreCalle): Coordenada[] {
  if (origen.tipo === "horizontal" && destino.tipo === "vertical") {
    return [[origen.coordenada[0], destino.coordenada[1]]];
  }

  if (origen.tipo === "vertical" && destino.tipo === "horizontal") {
    return [[destino.coordenada[0], origen.coordenada[1]]];
  }

  if (origen.tipo === "horizontal" && destino.tipo === "horizontal") {
    return origen.coordenada[0] === destino.coordenada[0]
      ? []
      : [[origen.coordenada[0], -93.1015], [destino.coordenada[0], -93.1015]];
  }

  return origen.coordenada[1] === destino.coordenada[1]
    ? []
    : [[16.6175, origen.coordenada[1]], [16.6175, destino.coordenada[1]]];
}

export function construirGeometriaLocalPorCalles(puntos: Coordenada[]): ResultadoAjusteCalle & {
  geometria?: Coordenada[];
} {
  if (puntos.length < 2) {
    return { valido: false, mensaje: "Se necesitan al menos 2 puntos para calcular una ruta vial." };
  }

  const ajustados = puntos.map(ajustarPuntoACalleLocal);
  const invalido = ajustados.find((resultado) => !resultado.valido || !resultado.punto);

  if (invalido) {
    return { valido: false, mensaje: invalido.mensaje };
  }

  const sobreCalles = ajustados.map((resultado) => resultado.punto as PuntoSobreCalle);
  const geometria: Coordenada[] = [];

  for (let index = 0; index < sobreCalles.length - 1; index += 1) {
    const origen = sobreCalles[index];
    const destino = sobreCalles[index + 1];
    const tramo = [origen.coordenada, ...puntoIntermedioPorCalles(origen, destino), destino.coordenada];

    if (index === 0) {
      geometria.push(...tramo);
    } else {
      geometria.push(...tramo.slice(1));
    }
  }

  return { valido: true, punto: sobreCalles[0], geometria };
}
