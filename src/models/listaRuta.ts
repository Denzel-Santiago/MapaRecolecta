import { PESO_BASE } from "../constants/mapa";
import type { PuntoRuta } from "./rutaDiseñada";

/**
 * Punto de ruta con su peso (clave de posicion del modo detector).
 * Ver PLAN_MAPA_COMPLETO.md, seccion 6.3.
 */
export interface PuntoConPeso extends PuntoRuta {
  peso: number;
}

export interface NodoPunto {
  punto: PuntoConPeso;
  anterior: NodoPunto | null;
  siguiente: NodoPunto | null;
}

/**
 * Lista doblemente enlazada de puntos de ruta. Es la fuente de verdad del
 * orden real mientras se esta en modo detector: nunca se debe reconstruir el
 * orden ordenando por `peso` (puede haber empates), siempre recorriendo la
 * lista de `cabeza` a `cola` con `aArrayEnOrden`.
 */
export class ListaRuta {
  cabeza: NodoPunto | null = null;
  cola: NodoPunto | null = null;

  estaVacia(): boolean {
    return this.cabeza === null;
  }

  insertarAlFinal(punto: PuntoConPeso): NodoPunto {
    const nodo: NodoPunto = { punto, anterior: this.cola, siguiente: null };

    if (this.cola) {
      this.cola.siguiente = nodo;
    } else {
      this.cabeza = nodo;
    }

    this.cola = nodo;
    return nodo;
  }

  insertarAlInicio(punto: PuntoConPeso): NodoPunto {
    const nodo: NodoPunto = { punto, anterior: null, siguiente: this.cabeza };

    if (this.cabeza) {
      this.cabeza.anterior = nodo;
    } else {
      this.cola = nodo;
    }

    this.cabeza = nodo;
    return nodo;
  }

  insertarDespuesDe(nodo: NodoPunto, punto: PuntoConPeso): NodoPunto {
    const siguiente = nodo.siguiente;
    const nuevo: NodoPunto = { punto, anterior: nodo, siguiente };

    nodo.siguiente = nuevo;

    if (siguiente) {
      siguiente.anterior = nuevo;
    } else {
      this.cola = nuevo;
    }

    return nuevo;
  }

  insertarAntesDe(nodo: NodoPunto, punto: PuntoConPeso): NodoPunto {
    const anterior = nodo.anterior;
    const nuevo: NodoPunto = { punto, anterior, siguiente: nodo };

    nodo.anterior = nuevo;

    if (anterior) {
      anterior.siguiente = nuevo;
    } else {
      this.cabeza = nuevo;
    }

    return nuevo;
  }

  aArrayEnOrden(): PuntoConPeso[] {
    return this.nodosEnOrden().map((nodo) => nodo.punto);
  }

  /** Igual que aArrayEnOrden, pero devuelve los nodos (no solo los puntos). */
  nodosEnOrden(): NodoPunto[] {
    const resultado: NodoPunto[] = [];
    let actual = this.cabeza;

    while (actual) {
      resultado.push(actual);
      actual = actual.siguiente;
    }

    return resultado;
  }

  /**
   * True si dos nodos consecutivos quedaron con pesos demasiado cercanos
   * (por insertar muchas veces entre los mismos dos puntos). Ver
   * PLAN_MAPA_COMPLETO.md, seccion 6.3, ultimo punto.
   */
  necesitaRenumerar(epsilon = 0.0001): boolean {
    let actual = this.cabeza;

    while (actual && actual.siguiente) {
      if (Math.abs(actual.siguiente.punto.peso - actual.punto.peso) < epsilon) {
        return true;
      }

      actual = actual.siguiente;
    }

    return false;
  }

  /** Reasigna pesos limpios en multiplos de `base`, sin cambiar el orden real. */
  renumerarPesos(base: number = PESO_BASE): void {
    let actual = this.cabeza;
    let contador = 1;

    while (actual) {
      actual.punto = { ...actual.punto, peso: base * contador };
      actual = actual.siguiente;
      contador += 1;
    }
  }

  static desdeArray(puntos: PuntoConPeso[]): ListaRuta {
    const lista = new ListaRuta();

    for (const punto of puntos) {
      lista.insertarAlFinal(punto);
    }

    return lista;
  }
}
