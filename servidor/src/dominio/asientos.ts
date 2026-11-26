// Bancos de verdad: alrededor de la fogata, del círculo de sabios y de la biblioteca hay bancos con asientos.
// Quien quiere descansar, calentarse, charlar o estudiar busca un asiento libre, camina hasta él y se sienta
// mirando al centro. Sin asiento libre se queda de pie (nadie se sienta en el aire). El visor dibuja los bancos
// en las mismas posiciones (modelos.gd → _bancos).
import type { Mundo } from "./mundo.ts";
import type { Colono, Estructura } from "./tipos.ts";

/** Bancos por construcción: distancia al centro, cuántos bancos, desfase angular. */
export const BANCOS: Readonly<Record<string, { readonly radio: number; readonly bancos: number; readonly desfase: number }>> = {
  fogata: { radio: 2.3, bancos: 4, desfase: 0.4 },
  circulo: { radio: 1.25, bancos: 3, desfase: 0.0 },
  biblioteca: { radio: 3.6, bancos: 2, desfase: 1.2 },
};

export interface Asiento { readonly clave: string; readonly x: number; readonly z: number; readonly mira: number }

/** Dos asientos por banco, en coordenadas del mundo, mirando al centro. */
export function asientos(e: Estructura): Asiento[] {
  const b = BANCOS[e.tipo];
  if (!b || e.progreso < 1) return [];
  const ux = Math.cos(e.rot), uz = -Math.sin(e.rot), vx = Math.sin(e.rot), vz = Math.cos(e.rot);
  const r: Asiento[] = [];
  for (let k = 0; k < b.bancos; k++) {
    const a = b.desfase + (Math.PI * 2 * k) / b.bancos;
    const cx = Math.cos(a) * b.radio, cz = Math.sin(a) * b.radio;
    const tx = -Math.sin(a), tz = Math.cos(a);
    for (const s of [-0.35, 0.35]) {
      const lx = cx + tx * s, lz = cz + tz * s;
      const x = e.x + ux * lx + vx * lz, z = e.z + uz * lx + vz * lz;
      r.push({ clave: `${e.id}:${k}:${s > 0 ? 1 : 0}`, x, z, mira: Math.atan2(e.x - x, e.z - z) });
    }
  }
  return r;
}

/** Asiento libre más cercano en las construcciones de su tribu a menos de `radio`. */
export function asientoLibre(m: Mundo, c: Colono, radio = 45, tipos?: readonly string[]): Asiento | null {
  const ocupados = new Set<string>();
  for (const o of m.colonos.values()) {
    const s = o.vivo && o.id !== c.id ? o.actividad?.datos.asiento : undefined;
    if (typeof s === "string") ocupados.add(s);
  }
  let mejor: Asiento | null = null, md = radio;
  for (const e of m.estructuras.values()) {
    if (e.tribu !== c.tribu || !BANCOS[e.tipo] || (tipos && !tipos.includes(e.tipo))) continue;
    if (Math.hypot(e.x - c.x, e.z - c.z) > radio + 5) continue;
    for (const s of asientos(e)) {
      if (ocupados.has(s.clave) || !m.pisable(s.x, s.z)) continue;
      const d = Math.hypot(s.x - c.x, s.z - c.z);
      if (d < md) { md = d; mejor = s; }
    }
  }
  return mejor;
}

/** Está sentado en su asiento (para el visor). */
export function sentado(c: Colono): boolean {
  const a = c.actividad;
  if (!a?.destino || typeof a.datos.asiento !== "string") return false;
  return Math.hypot(a.destino.x - c.x, a.destino.z - c.z) <= a.destino.alcance + 0.05;
}
