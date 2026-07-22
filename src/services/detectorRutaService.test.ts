import { describe, expect, it } from "vitest";
import { PESO_BASE } from "../constants/mapa";
import type { PuntoConPeso } from "../models/listaRuta";
import { procesarDeteccion, puntosRutaAConPeso } from "./detectorRutaService";

// Deltas de referencia en grados, para mantener las distancias realistas
// respecto a UMBRAL_VECINO_METROS (40m por defecto):
// 0.0001 grados de latitud ~ 11 metros
// 0.0003 grados de latitud ~ 33 metros
// 0.0006 grados de latitud ~ 66 metros

function crearPunto(orden: number, lat: number, lon: number, peso: number): PuntoConPeso {
  return { punto_id: orden, cp: orden, orden, lat, lon, lng: lon, peso };
}

describe("procesarDeteccion", () => {
  it("el primer punto de una ruta vacia se guarda con PESO_BASE", () => {
    const resultado = procesarDeteccion([16.61, -93.1], [], []);
    expect(resultado.conectados).toHaveLength(1);
    expect(resultado.conectados[0].peso).toBe(PESO_BASE);
    expect(resultado.pendientes).toHaveLength(0);
  });

  it("sin vecino dentro del umbral, el punto queda pendiente con peso 0", () => {
    const conectados = [crearPunto(1, 16.61, -93.1, 10)];
    // Punto a decenas de km de distancia: muy por encima del umbral de 40m.
    const resultado = procesarDeteccion([16.9, -93.5], conectados, [], 40);
    expect(resultado.conectados).toEqual(conectados);
    expect(resultado.pendientes).toHaveLength(1);
    expect(resultado.pendientes[0].peso).toBe(0);
  });

  it("extiende la cola cuando el candidato continua la ruta", () => {
    const conectados = [crearPunto(1, 16.61, -93.1, 10), crearPunto(2, 16.6103, -93.1, 20)];
    const resultado = procesarDeteccion([16.6106, -93.1], conectados, []);
    expect(resultado.conectados).toHaveLength(3);
    expect(resultado.conectados.map((p) => p.peso)).toEqual([10, 20, 30]);
  });

  it("inserta entre dos puntos ya conectados cuando el candidato esta en medio", () => {
    const conectados = [
      crearPunto(1, 16.61, -93.1, 10),
      crearPunto(2, 16.6106, -93.1, 20),
      crearPunto(3, 16.6112, -93.1, 30),
    ];
    // Cae cerca del punto de en medio (peso 20), del lado del primero.
    const resultado = procesarDeteccion([16.6104, -93.1], conectados, []);
    expect(resultado.conectados.map((p) => p.peso)).toEqual([10, 15, 20, 30]);
  });

  it("reconecta un punto pendiente y agrega el candidato despues", () => {
    const conectados = [crearPunto(1, 16.61, -93.1, 10)];
    const pendientes = [crearPunto(2, 16.7, -93.2, 0)];
    // El candidato cae a ~11m del pendiente, muy lejos del conectado.
    const resultado = procesarDeteccion([16.7001, -93.2], conectados, pendientes, 40);
    expect(resultado.pendientes).toHaveLength(0);
    expect(resultado.conectados).toHaveLength(3);
    expect(resultado.conectados.map((p) => p.peso)).toEqual([10, 20, 30]);
  });

  it("ignora un candidato demasiado cerca de un punto conectado (duplicado)", () => {
    const conectados = [crearPunto(1, 16.61, -93.1, 10)];
    // ~1 metro de distancia: muy por debajo del minimo de duplicado (3m).
    const resultado = procesarDeteccion([16.610001, -93.1], conectados, []);
    expect(resultado.duplicado).toBe(true);
    expect(resultado.conectados).toEqual(conectados);
    expect(resultado.pendientes).toEqual([]);
  });

  it("ignora un candidato demasiado cerca de un punto pendiente (duplicado)", () => {
    const pendientes = [crearPunto(1, 16.61, -93.1, 0)];
    const resultado = procesarDeteccion([16.610001, -93.1], [], pendientes);
    expect(resultado.duplicado).toBe(true);
    expect(resultado.pendientes).toEqual(pendientes);
  });
});

describe("puntosRutaAConPeso", () => {
  it("asigna pesos limpios en multiplos de PESO_BASE respetando el orden", () => {
    const puntos = [
      { punto_id: 2, cp: 2, orden: 2, lat: 16.62, lon: -93.11, lng: -93.11 },
      { punto_id: 1, cp: 1, orden: 1, lat: 16.61, lon: -93.1, lng: -93.1 },
    ];

    const resultado = puntosRutaAConPeso(puntos);
    expect(resultado.map((p) => p.orden)).toEqual([1, 2]);
    expect(resultado.map((p) => p.peso)).toEqual([PESO_BASE, PESO_BASE * 2]);
  });
});
