import { describe, expect, it } from "vitest";
import type { RutaDiseñada } from "../models/rutaDiseñada";
import { esIdTemporal } from "../models/rutaBorrador";
import {
  agregarPuntoBorrador,
  construirPayloadSync,
  eliminarPuntoBorrador,
  moverPuntoBorrador,
  puedePublicarse,
  publicarRuta,
  puntosVisiblesDelBorrador,
  reordenarPuntoBorrador,
  rutaBorradorARutaDiseñada,
  rutaDiseñadaARutaBorrador,
  sincronizarConPuntos,
  tieneCambiosPendientes,
  volverABorrador,
} from "./rutaBorradorService";

function rutaDeEjemplo(): RutaDiseñada {
  return {
    ruta_id: 7,
    nombre: "Ruta Centro",
    descripcion: "desc",
    camion_id: 1,
    color: "#ff0000",
    puntos: [
      { punto_id: 101, cp: 1, orden: 1, lat: 16.7, lon: -93.1 },
      { punto_id: 102, cp: 2, orden: 2, lat: 16.71, lon: -93.11 },
    ],
  };
}

describe("rutaDiseñadaARutaBorrador", () => {
  it("marca sin_cambios los puntos que ya tienen punto_id real", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    expect(borrador.puntos).toHaveLength(2);
    expect(borrador.puntos.every((p) => p.estado === "sin_cambios")).toBe(true);
    expect(borrador.estadoPublicacion).toBe("BORRADOR");
  });
});

describe("agregarPuntoBorrador", () => {
  it("crea un punto nuevo con id temporal, al final de la lista", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const conNuevo = agregarPuntoBorrador(borrador, [16.72, -93.12]);
    expect(conNuevo.puntos).toHaveLength(3);

    const nuevo = conNuevo.puntos[2];
    expect(nuevo.estado).toBe("nuevo");
    expect(esIdTemporal(nuevo.punto_id)).toBe(true);
    expect(nuevo.orden).toBe(3);
  });
});

describe("moverPuntoBorrador", () => {
  it("con id real, marca el viejo como eliminado y crea un reemplazo temporal", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const movido = moverPuntoBorrador(borrador, 101, [16.9, -93.3]);

    const viejo = movido.puntos.find((p) => p.punto_id === 101);
    expect(viejo?.estado).toBe("eliminado");

    const reemplazo = movido.puntos.find((p) => p.lat === 16.9 && p.lon === -93.3);
    expect(reemplazo).toBeDefined();
    expect(reemplazo?.estado).toBe("nuevo");
    expect(esIdTemporal(reemplazo!.punto_id)).toBe(true);
    expect(movido.puntos).toHaveLength(3);
  });

  it("con id temporal, actualiza la coordenada en su lugar sin generar basura", () => {
    const borrador = agregarPuntoBorrador(rutaDiseñadaARutaBorrador(rutaDeEjemplo()), [16.72, -93.12]);
    const idTemporal = borrador.puntos[2].punto_id;

    const movido = moverPuntoBorrador(borrador, idTemporal, [1, 2]);
    expect(movido.puntos).toHaveLength(3);

    const actualizado = movido.puntos.find((p) => p.punto_id === idTemporal);
    expect(actualizado?.lat).toBe(1);
    expect(actualizado?.lon).toBe(2);
    expect(actualizado?.estado).toBe("nuevo");
  });
});

describe("eliminarPuntoBorrador", () => {
  it("con id real, lo marca eliminado sin quitarlo del arreglo", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const resultado = eliminarPuntoBorrador(borrador, 101);
    expect(resultado.puntos).toHaveLength(2);
    expect(resultado.puntos.find((p) => p.punto_id === 101)?.estado).toBe("eliminado");
  });

  it("con id temporal, lo quita del arreglo sin dejar rastro", () => {
    const borrador = agregarPuntoBorrador(rutaDiseñadaARutaBorrador(rutaDeEjemplo()), [16.72, -93.12]);
    const idTemporal = borrador.puntos[2].punto_id;

    const resultado = eliminarPuntoBorrador(borrador, idTemporal);
    expect(resultado.puntos).toHaveLength(2);
    expect(resultado.puntos.some((p) => p.punto_id === idTemporal)).toBe(false);
  });
});

describe("reordenarPuntoBorrador", () => {
  it("usa orden flotante y pasa un punto sin_cambios a reordenado", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const resultado = reordenarPuntoBorrador(borrador, 101, 1.5);
    const punto = resultado.puntos.find((p) => p.punto_id === 101);
    expect(punto?.orden).toBe(1.5);
    expect(punto?.estado).toBe("reordenado");
  });

  it("no degrada el estado de un punto que ya era nuevo", () => {
    const borrador = agregarPuntoBorrador(rutaDiseñadaARutaBorrador(rutaDeEjemplo()), [16.72, -93.12]);
    const idTemporal = borrador.puntos[2].punto_id;
    const resultado = reordenarPuntoBorrador(borrador, idTemporal, 0.5);
    expect(resultado.puntos.find((p) => p.punto_id === idTemporal)?.estado).toBe("nuevo");
  });
});

describe("tieneCambiosPendientes", () => {
  it("es false para un borrador recien cargado", () => {
    expect(tieneCambiosPendientes(rutaDiseñadaARutaBorrador(rutaDeEjemplo()))).toBe(false);
  });

  it("es true en cuanto hay un punto que no sea sin_cambios", () => {
    const borrador = agregarPuntoBorrador(rutaDiseñadaARutaBorrador(rutaDeEjemplo()), [16.72, -93.12]);
    expect(tieneCambiosPendientes(borrador)).toBe(true);
  });
});

describe("puntosVisiblesDelBorrador", () => {
  it("filtra los puntos eliminados y ordena por orden", () => {
    const borrador = eliminarPuntoBorrador(rutaDiseñadaARutaBorrador(rutaDeEjemplo()), 101);
    const visibles = puntosVisiblesDelBorrador(borrador);
    expect(visibles).toHaveLength(1);
    expect(visibles[0].punto_id).toBe(102);
  });
});

describe("construirPayloadSync", () => {
  it("separa nuevos, actualizados y eliminados con id real", () => {
    let borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    borrador = agregarPuntoBorrador(borrador, [16.72, -93.12]);
    borrador = reordenarPuntoBorrador(borrador, 101, 1.5);

    const payload = construirPayloadSync(borrador);
    expect(payload.ruta_id).toBe(7);
    expect(payload.nuevos).toHaveLength(1);
    expect(payload.actualizados).toEqual([
      expect.objectContaining({ punto_id: 101, orden: 1.5 }),
    ]);
    expect(payload.eliminados).toEqual([]);
  });

  it("incluye los eliminados con id real", () => {
    const borrador = eliminarPuntoBorrador(rutaDiseñadaARutaBorrador(rutaDeEjemplo()), 101);
    const payload = construirPayloadSync(borrador);
    expect(payload.eliminados).toEqual([101]);
  });

  it("cp siempre es String(orden), nunca un cp interno que pudo quedar desincronizado", () => {
    let borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    borrador = agregarPuntoBorrador(borrador, [16.72, -93.12]); // orden 3, nuevo
    // El punto 101 tenia cp interno "1" (ver rutaDeEjemplo); se reordena a 1.5
    // sin tocar ese cp interno, para probar que el payload no usa ese valor viejo.
    borrador = reordenarPuntoBorrador(borrador, 101, 1.5);

    const payload = construirPayloadSync(borrador);
    expect(payload.nuevos[0].cp).toBe("3");
    expect(typeof payload.nuevos[0].cp).toBe("string");
    expect(payload.actualizados[0].cp).toBe("1.5");
    expect(payload.actualizados[0].orden).toBe(1.5);
  });

  it("lanza un error si el borrador no tiene ruta_id", () => {
    const borrador = { ...rutaDiseñadaARutaBorrador(rutaDeEjemplo()), ruta_id: null };
    expect(() => construirPayloadSync(borrador)).toThrow(/ruta_id/);
  });
});

describe("sincronizarConPuntos", () => {
  it("no marca cambios si las coordenadas activas son identicas", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const mismas = borrador.puntos.map((p): [number, number] => [p.lat, p.lon]);
    const resultado = sincronizarConPuntos(borrador, mismas);
    expect(tieneCambiosPendientes(resultado)).toBe(false);
    expect(resultado.puntos.every((p) => !esIdTemporal(p.punto_id))).toBe(true);
  });

  it("detecta una coordenada nueva agregada al final", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const conNueva: Array<[number, number]> = [
      ...borrador.puntos.map((p): [number, number] => [p.lat, p.lon]),
      [16.73, -93.13],
    ];
    const resultado = sincronizarConPuntos(borrador, conNueva);
    expect(resultado.puntos.filter((p) => p.estado === "nuevo")).toHaveLength(1);
    expect(resultado.puntos.filter((p) => p.estado === "sin_cambios")).toHaveLength(2);
  });

  it("marca eliminado un punto real que ya no esta en las coordenadas activas", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const sinUltimo: Array<[number, number]> = [[16.7, -93.1]];
    const resultado = sincronizarConPuntos(borrador, sinUltimo);
    const eliminado = resultado.puntos.find((p) => p.punto_id === 102);
    expect(eliminado?.estado).toBe("eliminado");
    expect(resultado.puntos.filter((p) => p.estado !== "eliminado")).toHaveLength(1);
  });

  it("trata un punto 'movido' como eliminar+crear, no como identidad conservada", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const movidas: Array<[number, number]> = [
      [16.7, -93.1],
      [16.9, -93.3],
    ];
    const resultado = sincronizarConPuntos(borrador, movidas);
    expect(resultado.puntos.find((p) => p.punto_id === 102)?.estado).toBe("eliminado");

    const nuevoPorMovimiento = resultado.puntos.find((p) => p.lat === 16.9 && p.lon === -93.3);
    expect(nuevoPorMovimiento?.estado).toBe("nuevo");
    expect(esIdTemporal(nuevoPorMovimiento!.punto_id)).toBe(true);
  });

  it("descarta sin rastro un punto temporal que se quita antes de guardar", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const conTemporal = sincronizarConPuntos(borrador, [
      ...borrador.puntos.map((p): [number, number] => [p.lat, p.lon]),
      [16.73, -93.13],
    ]);
    const idTemporal = conTemporal.puntos.find((p) => p.estado === "nuevo")!.punto_id;

    const sinTemporal = sincronizarConPuntos(
      conTemporal,
      borrador.puntos.map((p): [number, number] => [p.lat, p.lon])
    );
    expect(sinTemporal.puntos.some((p) => p.punto_id === idTemporal)).toBe(false);
  });
});

describe("rutaBorradorARutaDiseñada", () => {
  it("reconstruye orden secuencial y devuelve null para ids temporales", () => {
    let borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    borrador = eliminarPuntoBorrador(borrador, 101);
    borrador = agregarPuntoBorrador(borrador, [16.73, -93.13]);

    const ruta = rutaBorradorARutaDiseñada(borrador);
    expect(ruta.puntos).toHaveLength(2);
    expect(ruta.puntos.every((p, i) => p.orden === i + 1)).toBe(true);
    expect(ruta.puntos.some((p) => p.punto_id === null)).toBe(true);
  });
});

describe("puedePublicarse / publicarRuta / volverABorrador", () => {
  it("puedePublicarse exige geometria oficial con al menos 2 puntos", () => {
    expect(puedePublicarse(null)).toBe(false);
    expect(puedePublicarse(undefined)).toBe(false);
    expect(puedePublicarse([])).toBe(false);
    expect(puedePublicarse([[16.7, -93.1]])).toBe(false);
    expect(
      puedePublicarse([
        [16.7, -93.1],
        [16.71, -93.11],
      ])
    ).toBe(true);
  });

  it("publicar sin geometria oficial deja el estado en ERROR", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const resultado = publicarRuta(borrador, null);
    expect(resultado.estadoPublicacion).toBe("ERROR");
  });

  it("publicar con geometria oficial valida deja el estado en PUBLICADA", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const geometria: Array<[number, number]> = [
      [16.7, -93.1],
      [16.705, -93.105],
      [16.71, -93.11],
    ];
    const resultado = publicarRuta(borrador, geometria);
    expect(resultado.estadoPublicacion).toBe("PUBLICADA");
  });

  it("volverABorrador solo cambia el estado de publicacion, no los puntos", () => {
    const borrador = rutaDiseñadaARutaBorrador(rutaDeEjemplo());
    const publicado = publicarRuta(borrador, [
      [16.7, -93.1],
      [16.71, -93.11],
    ]);
    const vuelto = volverABorrador(publicado);
    expect(vuelto.estadoPublicacion).toBe("BORRADOR");
    expect(vuelto.puntos).toEqual(publicado.puntos);
  });
});
