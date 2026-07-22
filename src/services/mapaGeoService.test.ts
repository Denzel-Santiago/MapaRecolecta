import { describe, expect, it } from "vitest";
import { PESO_BASE } from "../constants/mapa";
import type { PuntoConPeso } from "../models/listaRuta";
import { ListaRuta } from "../models/listaRuta";
import {
  calcularAnguloGiro,
  calcularDistanciaMetros,
  calcularPesoNuevoPunto,
  encontrarVecinoMasCercano,
  esGiroDeCurva,
  estaDentroDeSuchiapa,
  generarGeometriaVisual,
} from "./mapaGeoService";

function crearPunto(orden: number, lat: number, lon: number, peso: number): PuntoConPeso {
  return { punto_id: orden, cp: orden, orden, lat, lon, lng: lon, peso };
}

describe("calcularDistanciaMetros", () => {
  it("da 0 para el mismo punto", () => {
    expect(calcularDistanciaMetros([16.6166, -93.1], [16.6166, -93.1])).toBeCloseTo(0, 5);
  });

  it("da una distancia positiva razonable entre dos puntos de Suchiapa", () => {
    // ~0.01 grados de diferencia son unos cuantos cientos de metros, no miles.
    const distancia = calcularDistanciaMetros([16.6166, -93.1], [16.6266, -93.11]);
    expect(distancia).toBeGreaterThan(500);
    expect(distancia).toBeLessThan(2000);
  });
});

describe("estaDentroDeSuchiapa", () => {
  it("acepta el centro de Suchiapa", () => {
    expect(estaDentroDeSuchiapa([16.6166, -93.1])).toBe(true);
  });

  it("rechaza un punto claramente fuera de los limites", () => {
    expect(estaDentroDeSuchiapa([19.4326, -99.1332])).toBe(false); // CDMX
  });
});

describe("encontrarVecinoMasCercano", () => {
  it("devuelve null si no hay puntos", () => {
    expect(encontrarVecinoMasCercano([16.6166, -93.1], [])).toBeNull();
  });

  it("encuentra el punto mas cercano entre varios", () => {
    const puntos = [
      { id: "a", coordenada: [16.6166, -93.1] as [number, number] },
      { id: "b", coordenada: [16.62, -93.11] as [number, number] },
      { id: "c", coordenada: [16.6167, -93.1001] as [number, number] },
    ];

    const resultado = encontrarVecinoMasCercano([16.6166, -93.1], puntos);
    expect(resultado?.id).toBe("a");
    expect(resultado?.distancia).toBeCloseTo(0, 3);
  });
});

describe("calcularPesoNuevoPunto", () => {
  it("promedia cuando el candidato cae entre dos nodos ya conectados", () => {
    const lista = new ListaRuta();
    const nodoA = lista.insertarAlFinal(crearPunto(1, 16.61, -93.1, 10));
    lista.insertarAlFinal(crearPunto(2, 16.63, -93.12, 30));

    // El candidato esta geograficamente mas cerca de nodoA (que es el que
    // devolveria encontrarVecinoMasCercano) y cae entre nodoA y su siguiente.
    const resultado = calcularPesoNuevoPunto([16.611, -93.101], nodoA);

    expect(resultado.peso).toBe(20); // promedio de 10 y 30
    expect(resultado.posicion).toBe("despues");
    expect(resultado.insertarJuntoA).toBe(nodoA);
  });

  it("extender despues de la cola usa peso de la cola + PESO_BASE", () => {
    const lista = new ListaRuta();
    lista.insertarAlFinal(crearPunto(1, 16.61, -93.1, 10));
    const cola = lista.insertarAlFinal(crearPunto(2, 16.62, -93.11, 20));

    const resultado = calcularPesoNuevoPunto([16.63, -93.12], cola);

    expect(resultado.peso).toBe(20 + PESO_BASE);
    expect(resultado.posicion).toBe("despues");
    expect(resultado.insertarJuntoA).toBe(cola);
  });

  it("extender antes de la cabeza usa el promedio con el 0 virtual", () => {
    const lista = new ListaRuta();
    const cabeza = lista.insertarAlFinal(crearPunto(1, 16.61, -93.1, 10));
    lista.insertarAlFinal(crearPunto(2, 16.62, -93.11, 20));

    const resultado = calcularPesoNuevoPunto([16.6, -93.09], cabeza);

    expect(resultado.peso).toBe(5); // promedio de 0 (virtual) y 10
    expect(resultado.posicion).toBe("antes");
    expect(resultado.insertarJuntoA).toBe(cabeza);
  });

  it("con un solo punto en la lista, se trata como cola (extender al final)", () => {
    const lista = new ListaRuta();
    const unico = lista.insertarAlFinal(crearPunto(1, 16.61, -93.1, 10));

    const resultado = calcularPesoNuevoPunto([16.62, -93.11], unico);

    expect(resultado.peso).toBe(10 + PESO_BASE);
    expect(resultado.posicion).toBe("despues");
  });
});

describe("calcularAnguloGiro", () => {
  it("da 0 grados cuando los tres puntos estan en linea recta", () => {
    const angulo = calcularAnguloGiro([16.61, -93.1], [16.62, -93.1], [16.63, -93.1]);
    expect(angulo).toBeCloseTo(0, 3);
  });

  it("da 90 grados en una esquina real (angulo recto)", () => {
    const angulo = calcularAnguloGiro([16.61, -93.1], [16.62, -93.1], [16.62, -93.11]);
    expect(angulo).toBeCloseTo(90, 3);
  });

  it("da 0 si algun segmento tiene longitud cero", () => {
    expect(calcularAnguloGiro([16.61, -93.1], [16.61, -93.1], [16.62, -93.1])).toBe(0);
  });
});

describe("esGiroDeCurva", () => {
  it("un giro casi recto (cerca de 0) no es curva", () => {
    expect(esGiroDeCurva(2)).toBe(false);
  });

  it("una esquina real (90 grados) no es curva", () => {
    expect(esGiroDeCurva(90)).toBe(false);
  });

  it("un giro intermedio (dentro del rango) si es curva", () => {
    expect(esGiroDeCurva(45)).toBe(true);
  });

  it("respeta limites personalizados", () => {
    expect(esGiroDeCurva(10, 5, 20)).toBe(true);
    expect(esGiroDeCurva(25, 5, 20)).toBe(false);
  });
});

describe("generarGeometriaVisual", () => {
  it("con menos de 3 puntos devuelve los mismos puntos", () => {
    const puntos: [number, number][] = [[16.61, -93.1], [16.62, -93.11]];
    expect(generarGeometriaVisual(puntos)).toEqual(puntos);
  });

  it("en una linea recta no agrega puntos intermedios", () => {
    const puntos: [number, number][] = [
      [16.61, -93.1],
      [16.62, -93.1],
      [16.63, -93.1],
    ];
    expect(generarGeometriaVisual(puntos)).toEqual(puntos);
  });

  it("en una esquina real (90 grados) tampoco agrega puntos intermedios", () => {
    const puntos: [number, number][] = [
      [16.61, -93.1],
      [16.62, -93.1],
      [16.62, -93.11],
    ];
    expect(generarGeometriaVisual(puntos)).toEqual(puntos);
  });

  it("en un giro intermedio agrega puntos interpolados, empezando y terminando en los puntos reales", () => {
    const puntos: [number, number][] = [
      [16.61, -93.1],
      [16.615, -93.1],
      [16.618, -93.104],
      [16.62, -93.11],
    ];
    const resultado = generarGeometriaVisual(puntos, 4);
    expect(resultado.length).toBeGreaterThan(puntos.length);
    expect(resultado[0]).toEqual(puntos[0]);
    expect(resultado[resultado.length - 1]).toEqual(puntos[puntos.length - 1]);
  });
});
