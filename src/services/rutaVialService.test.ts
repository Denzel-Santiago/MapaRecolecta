import { describe, expect, it } from "vitest";
import { ErrorGeometriaVial, parsearRespuestaOsrm } from "./rutaVialService";

describe("parsearRespuestaOsrm", () => {
  it("convierte una respuesta valida, invirtiendo [lon,lat] a [lat,lon]", () => {
    const respuesta = {
      code: "Ok",
      routes: [
        {
          distance: 1234.5,
          duration: 210.3,
          geometry: {
            coordinates: [
              [-93.1, 16.7],
              [-93.11, 16.71],
              [-93.12, 16.72],
            ],
          },
        },
      ],
    };

    const resultado = parsearRespuestaOsrm(respuesta);
    expect(resultado.puntos).toHaveLength(3);
    expect(resultado.puntos[0]).toEqual([16.7, -93.1]);
    expect(resultado.distanciaMetros).toBe(1234.5);
    expect(resultado.duracionSegundos).toBe(210.3);
  });

  it("rechaza un code distinto de Ok", () => {
    expect(() => parsearRespuestaOsrm({ code: "NoRoute", routes: [] })).toThrow(ErrorGeometriaVial);
  });

  it("rechaza una respuesta sin routes", () => {
    expect(() => parsearRespuestaOsrm({ code: "Ok" })).toThrow(ErrorGeometriaVial);
  });

  it("rechaza una ruta sin geometry.coordinates", () => {
    expect(() =>
      parsearRespuestaOsrm({ code: "Ok", routes: [{ distance: 1, duration: 1 }] })
    ).toThrow(ErrorGeometriaVial);
  });

  it("rechaza json invalido (null o no-objeto)", () => {
    expect(() => parsearRespuestaOsrm(null)).toThrow(ErrorGeometriaVial);
    expect(() => parsearRespuestaOsrm("texto")).toThrow(ErrorGeometriaVial);
  });
});
