// Casos de uso del observador: avanzar el mundo, mirar (estado, tribus, fichas) y usar poderes de dios.
// La API para IAs externas volverá más adelante; por ahora las mentes de los colonos son internas.

import { PODERES, usarPoder } from "../dominio/poderes.ts";
import type { Mundo } from "../dominio/mundo.ts";
import { avanzar } from "../dominio/simulacion.ts";
import { fichaColono, fichaTribu, vistaEstado, vistaTribus } from "../dominio/vista.ts";

export class ServicioMundo {
  mundo: Mundo;

  constructor(mundo: Mundo) {
    this.mundo = mundo;
  }

  paso(): void {
    avanzar(this.mundo);
  }

  estado(): Record<string, unknown> {
    return vistaEstado(this.mundo);
  }

  tribus(): Record<string, unknown> {
    return vistaTribus(this.mundo);
  }

  /** Comandos del observador: poderes y fichas. */
  comando(c: Record<string, unknown>): Record<string, unknown> {
    switch (c.tipo) {
      case "poder": {
        const r = usarPoder(this.mundo, String(c.poder), { x: c.x as number, z: c.z as number, objetivo: c.objetivo as string });
        return r.ok ? { ok: true, mensaje: r.valor } : { ok: false, error: r.error };
      }
      case "ficha": {
        const f = fichaColono(this.mundo, String(c.id));
        return f ? { ok: true, ...f } : { ok: false, error: "no existe" };
      }
      case "fichaTribu": {
        const f = fichaTribu(this.mundo, String(c.id));
        return f ? { ok: true, ...f } : { ok: false, error: "no existe" };
      }
      case "poderes":
        return { ok: true, poderes: PODERES };
    }
    return { ok: false, error: `comando desconocido "${String(c.tipo)}"` };
  }

  /** Resumen público (GET /api/mundo). */
  resumen(): Record<string, unknown> {
    const m = this.mundo;
    return {
      dia: m.ciclo.dia, hora: m.hora, estacion: m.estacion, clima: m.clima.tipo,
      tribus: [...m.tribus.values()].map((t) => ({ nombre: t.nombre, poblacion: m.miembros(t.id).length, extinta: t.extinta })),
      ultimos: m.bitacora.filter((e) => e.interes >= 2).slice(-15).map((e) => `[día ${e.dia} ${e.hora}] ${e.texto}`),
    };
  }
}
