// Azar serializable del mundo. Es el mismo mulberry32 de `AzarSemilla` de TxNucleo, pero con el estado
// exportable: el bosque corre 24/7 y, si el servidor se reinicia, la secuencia de azar continúa donde quedó.

import type { Azar } from "txnucleo";

/** mulberry32 con estado público (para guardar y restaurar). */
export class AzarMundo implements Azar {
  estado: number;

  constructor(semilla: number) {
    this.estado = semilla >>> 0;
  }

  siguiente(): number {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Real en [a, b). */
  rango(a: number, b: number): number {
    return a + (b - a) * this.siguiente();
  }

  /** true con probabilidad `p`. */
  prob(p: number): boolean {
    return this.siguiente() < p;
  }
}
