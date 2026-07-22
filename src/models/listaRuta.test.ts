import { describe, expect, it } from "vitest";
import { ListaRuta, type PuntoConPeso } from "./listaRuta";

function crearPunto(orden: number, lat: number, lon: number, peso: number): PuntoConPeso {
  return { punto_id: orden, cp: orden, orden, lat, lon, lng: lon, peso };
}

describe("ListaRuta", () => {
  it("inserta al final y conserva el orden", () => {
    const lista = new ListaRuta();
    lista.insertarAlFinal(crearPunto(1, 16.61, -93.1, 10));
    lista.insertarAlFinal(crearPunto(2, 16.62, -93.11, 20));
    lista.insertarAlFinal(crearPunto(3, 16.63, -93.12, 30));

    expect(lista.aArrayEnOrden().map((p) => p.orden)).toEqual([1, 2, 3]);
    expect(lista.cabeza?.punto.orden).toBe(1);
    expect(lista.cola?.punto.orden).toBe(3);
  });

  it("inserta al inicio y actualiza la cabeza", () => {
    const lista = new ListaRuta();
    const nodo2 = lista.insertarAlFinal(crearPunto(2, 16.62, -93.11, 20));
    lista.insertarAlInicio(crearPunto(1, 16.61, -93.1, 10));

    expect(lista.aArrayEnOrden().map((p) => p.orden)).toEqual([1, 2]);
    expect(lista.cabeza?.punto.orden).toBe(1);
    expect(nodo2.anterior?.punto.orden).toBe(1);
  });

  it("inserta entre dos nodos existentes con insertarDespuesDe", () => {
    const lista = new ListaRuta();
    const nodoA = lista.insertarAlFinal(crearPunto(1, 16.61, -93.1, 10));
    lista.insertarAlFinal(crearPunto(3, 16.63, -93.12, 30));

    lista.insertarDespuesDe(nodoA, crearPunto(2, 16.62, -93.11, 20));

    expect(lista.aArrayEnOrden().map((p) => p.orden)).toEqual([1, 2, 3]);
  });

  it("inserta antes de un nodo con insertarAntesDe y ajusta la cabeza", () => {
    const lista = new ListaRuta();
    const nodoA = lista.insertarAlFinal(crearPunto(2, 16.62, -93.11, 20));

    lista.insertarAntesDe(nodoA, crearPunto(1, 16.61, -93.1, 10));

    expect(lista.aArrayEnOrden().map((p) => p.orden)).toEqual([1, 2]);
    expect(lista.cabeza?.punto.orden).toBe(1);
  });

  it("detecta cuando hace falta renumerar por precision", () => {
    const lista = new ListaRuta();
    lista.insertarAlFinal(crearPunto(1, 16.61, -93.1, 10));
    lista.insertarAlFinal(crearPunto(2, 16.62, -93.11, 10.00001));

    expect(lista.necesitaRenumerar()).toBe(true);
  });

  it("no marca renumeracion cuando los pesos estan bien separados", () => {
    const lista = new ListaRuta();
    lista.insertarAlFinal(crearPunto(1, 16.61, -93.1, 10));
    lista.insertarAlFinal(crearPunto(2, 16.62, -93.11, 20));

    expect(lista.necesitaRenumerar()).toBe(false);
  });

  it("renumerarPesos deja pesos limpios sin cambiar el orden", () => {
    const lista = new ListaRuta();
    lista.insertarAlFinal(crearPunto(1, 16.61, -93.1, 10));
    lista.insertarAlFinal(crearPunto(2, 16.62, -93.11, 10.00001));
    lista.insertarAlFinal(crearPunto(3, 16.63, -93.12, 10.00002));

    lista.renumerarPesos(10);

    expect(lista.aArrayEnOrden().map((p) => p.peso)).toEqual([10, 20, 30]);
    expect(lista.aArrayEnOrden().map((p) => p.orden)).toEqual([1, 2, 3]);
  });

  it("desdeArray reconstruye la misma secuencia", () => {
    const puntos = [crearPunto(1, 16.61, -93.1, 10), crearPunto(2, 16.62, -93.11, 20)];
    const lista = ListaRuta.desdeArray(puntos);

    expect(lista.aArrayEnOrden()).toEqual(puntos);
    expect(lista.estaVacia()).toBe(false);
  });

  it("una lista nueva esta vacia", () => {
    expect(new ListaRuta().estaVacia()).toBe(true);
  });
});
